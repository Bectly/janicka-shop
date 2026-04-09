import { getDb } from "@/lib/db";
import {
  REFERRAL_CREDIT_CZK,
  REFERRAL_DISCOUNT_CZK,
  REFERRAL_MIN_ORDER_CZK,
  REFERRAL_CODE_EXPIRY_DAYS,
  STORE_CREDIT_EXPIRY_DAYS,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Referral code generation
// ---------------------------------------------------------------------------

/** Generate a unique referral code like "REF-A1B2C3D4" */
function generateReferralCodeString(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8)
    .toUpperCase();
  return `REF-${rand}`;
}

/**
 * Create a referral code for a completed order.
 * Called after order creation — the code owner is the customer who placed the order.
 */
export async function createReferralCode(
  orderNumber: string,
  customerEmail: string,
): Promise<string> {
  const db = await getDb();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFERRAL_CODE_EXPIRY_DAYS);

  // Retry loop in case of code collision (extremely unlikely with 4 random bytes)
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateReferralCodeString();
    try {
      await db.referralCode.create({
        data: {
          code,
          orderNumber,
          customerEmail: customerEmail.toLowerCase(),
          creditAmount: REFERRAL_CREDIT_CZK * 100, // hellers
          discountAmount: REFERRAL_DISCOUNT_CZK * 100, // hellers
          expiresAt,
        },
      });
      return code;
    } catch (e: unknown) {
      // Unique constraint violation — retry with new code
      if (
        e instanceof Error &&
        e.message.includes("Unique constraint")
      ) {
        continue;
      }
      throw e;
    }
  }
  throw new Error("Failed to generate unique referral code after 3 attempts");
}

// ---------------------------------------------------------------------------
// Referral code validation
// ---------------------------------------------------------------------------

export type ReferralValidation =
  | { valid: true; code: string; discountCzk: number }
  | { valid: false; reason: string };

/**
 * Validate a referral code for use at checkout.
 * Returns discount amount in CZK if valid, or an error reason.
 */
export async function validateReferralCode(
  code: string,
  customerEmail: string,
): Promise<ReferralValidation> {
  if (!code || code.trim().length === 0) {
    return { valid: false, reason: "Kód je prázdný" };
  }

  const db = await getDb();
  const referral = await db.referralCode.findUnique({
    where: { code: code.trim().toUpperCase() },
  });

  if (!referral) {
    return { valid: false, reason: "Neplatný kód doporučení" };
  }

  if (referral.status !== "pending") {
    return { valid: false, reason: "Tento kód již byl použit" };
  }

  if (new Date() > referral.expiresAt) {
    return { valid: false, reason: "Platnost kódu vypršela" };
  }

  // Prevent self-referral
  if (referral.customerEmail === customerEmail.toLowerCase()) {
    return { valid: false, reason: "Nemůžete použít vlastní kód doporučení" };
  }

  return {
    valid: true,
    code: referral.code,
    discountCzk: referral.discountAmount / 100,
  };
}

// ---------------------------------------------------------------------------
// Referral redemption (called inside order transaction)
// ---------------------------------------------------------------------------

/**
 * Redeem a referral code: mark it as used and create store credit for the referrer.
 * Must be called within a Prisma transaction.
 */
export async function redeemReferralCode(
  tx: Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["$transaction"]>[0]>[0],
  code: string,
  redeemedByOrderNumber: string,
): Promise<void> {
  const referral = await tx.referralCode.update({
    where: { code },
    data: {
      status: "redeemed",
      usedByOrderNumber: redeemedByOrderNumber,
      redeemedAt: new Date(),
    },
  });

  // Create store credit for the referrer
  const creditExpiresAt = new Date();
  creditExpiresAt.setDate(creditExpiresAt.getDate() + STORE_CREDIT_EXPIRY_DAYS);

  await tx.storeCredit.create({
    data: {
      customerEmail: referral.customerEmail,
      amount: referral.creditAmount,
      remainingAmount: referral.creditAmount,
      reason: `Doporučení — objednávka ${redeemedByOrderNumber}`,
      sourceOrderNumber: redeemedByOrderNumber,
      expiresAt: creditExpiresAt,
    },
  });
}

// ---------------------------------------------------------------------------
// Store credit
// ---------------------------------------------------------------------------

/**
 * Get total available store credit for a customer email (in CZK).
 * Only counts credits that are not expired and have remaining balance.
 */
export async function getAvailableStoreCredit(
  customerEmail: string,
): Promise<number> {
  const db = await getDb();
  const credits = await db.storeCredit.findMany({
    where: {
      customerEmail: customerEmail.toLowerCase(),
      remainingAmount: { gt: 0 },
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "asc" }, // use oldest first (FIFO)
  });

  const totalHellers = credits.reduce((sum, c) => sum + c.remainingAmount, 0);
  return totalHellers / 100;
}

/**
 * Apply store credit to an order. Deducts from credits (oldest first).
 * Must be called within a Prisma transaction.
 * Returns the actual amount deducted in CZK.
 */
export async function applyStoreCredit(
  tx: Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["$transaction"]>[0]>[0],
  customerEmail: string,
  maxAmountCzk: number,
): Promise<number> {
  if (maxAmountCzk <= 0) return 0;

  const credits = await tx.storeCredit.findMany({
    where: {
      customerEmail: customerEmail.toLowerCase(),
      remainingAmount: { gt: 0 },
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "asc" },
  });

  let remainingToDeduct = Math.round(maxAmountCzk * 100); // hellers
  let totalDeducted = 0;

  for (const credit of credits) {
    if (remainingToDeduct <= 0) break;

    const deduct = Math.min(credit.remainingAmount, remainingToDeduct);
    const newRemaining = credit.remainingAmount - deduct;

    await tx.storeCredit.update({
      where: { id: credit.id },
      data: {
        remainingAmount: newRemaining,
        ...(newRemaining === 0 ? { usedAt: new Date() } : {}),
      },
    });

    totalDeducted += deduct;
    remainingToDeduct -= deduct;
  }

  return totalDeducted / 100; // back to CZK
}

// ---------------------------------------------------------------------------
// Server action for checkout validation (called from client)
// ---------------------------------------------------------------------------

/**
 * Validate referral code + get store credit for checkout preview.
 * Used by the checkout page to show discounts before order submission.
 */
export async function getCheckoutDiscounts(
  referralCode: string | null,
  customerEmail: string | null,
): Promise<{
  referralDiscount: number;
  referralCode: string | null;
  referralError: string | null;
  storeCredit: number;
}> {
  let referralDiscount = 0;
  let validReferralCode: string | null = null;
  let referralError: string | null = null;
  let storeCredit = 0;

  if (referralCode && customerEmail) {
    const result = await validateReferralCode(referralCode, customerEmail);
    if (result.valid) {
      referralDiscount = result.discountCzk;
      validReferralCode = result.code;
    } else {
      referralError = result.reason;
    }
  }

  if (customerEmail) {
    storeCredit = await getAvailableStoreCredit(customerEmail);
  }

  return {
    referralDiscount,
    referralCode: validReferralCode,
    referralError,
    storeCredit,
  };
}
