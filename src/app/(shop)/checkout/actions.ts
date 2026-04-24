"use server";

import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { getPaymentProvider } from "@/lib/payments/provider";
import { rateLimitCheckout } from "@/lib/rate-limit";
import { sendOrderConfirmationEmail, sendAdminNewOrderEmail } from "@/lib/email";
import { dispatchEmail } from "@/lib/email-dispatch";
import { sendSimilarItemNotifications } from "@/lib/email/similar-item";
import { sendWishlistSoldNotifications } from "@/lib/email/wishlist-sold";
import { logOrderToHeureka } from "@/lib/heureka";
import { revalidatePath, revalidateTag } from "next/cache";
import { invalidateProductCaches } from "@/lib/redis";
import {
  PAYMENT_METHODS,
  SHIPPING_METHODS,
  SHIPPING_PRICES,
  FREE_SHIPPING_THRESHOLD,
  COD_SURCHARGE,
  REFERRAL_MIN_ORDER_CZK,
  type PaymentMethod,
  type ShippingMethod,
} from "@/lib/constants";
import {
  validateReferralCode,
  redeemReferralCode,
  applyStoreCredit,
  createReferralCode,
  getAvailableStoreCredit,
  getCheckoutDiscounts,
} from "@/lib/referral";

import { logger } from "@/lib/logger";
const checkoutSchema = z
  .object({
    email: z.string().email("Zadejte platný email").max(254),
    firstName: z.string().min(1, "Jméno je povinné").max(100, "Jméno je příliš dlouhé"),
    lastName: z.string().min(1, "Příjmení je povinné").max(100, "Příjmení je příliš dlouhé"),
    phone: z.string()
      .regex(/^\+?[\d \-()]{9,30}$/, "Zadejte platné telefonní číslo")
      .optional()
      .or(z.literal("")),
    // Address fields — required only for home delivery methods (validated in refine)
    street: z.string().max(200, "Adresa je příliš dlouhá").optional(),
    city: z.string().max(100, "Název města je příliš dlouhý").optional(),
    zip: z.string().max(10, "Neplatné PSČ").optional(),
    note: z.string().max(2000, "Poznámka může mít maximálně 2000 znaků").optional(),
    paymentMethod: z.enum(PAYMENT_METHODS, {
      error: "Vyberte platný způsob platby",
    }),
    shippingMethod: z.enum(SHIPPING_METHODS, {
      error: "Vyberte platný způsob dopravy",
    }),
    // Packeta pickup point fields — required when shippingMethod is packeta_pickup
    packetaPointId: z.string().max(64).optional(),
    packetaPointName: z.string().max(256).optional(),
    packetaPointAddress: z.string().max(512).optional(),
    referralCode: z.string().max(20).optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1, "Neplatný produkt").max(128),
          name: z.string().min(1).max(300),
          price: z.number().finite().positive(),
          size: z.string().max(50),
          color: z.string().max(50),
          quantity: z.number().int().positive().max(1, "Second-hand: max 1 ks na produkt"),
        })
      )
      .min(1, "Košík je prázdný")
      .max(50, "Příliš mnoho položek v košíku"),
  })
  .refine(
    (data) => {
      // Second-hand: each product is unique — reject duplicate productIds
      const ids = data.items.map((i) => i.productId);
      return new Set(ids).size === ids.length;
    },
    {
      message: "Duplicitní produkty v košíku",
      path: ["items"],
    }
  )
  .refine(
    (data) => {
      // Phone required for home delivery (courier needs contact number)
      // Optional for Packeta pickup (39% mobile abandonment at phone fields — Scout C1499)
      if (data.shippingMethod !== "packeta_pickup") {
        return !!data.phone?.trim();
      }
      return true;
    },
    {
      message: "Telefon je povinný pro doručení na adresu",
      path: ["phone"],
    }
  )
  .refine(
    (data) => {
      // Address required for home delivery methods
      if (data.shippingMethod !== "packeta_pickup") {
        return (
          !!data.street?.trim() && !!data.city?.trim() && !!data.zip?.trim()
        );
      }
      return true;
    },
    {
      message: "Vyplňte doručovací adresu",
      path: ["street"],
    }
  )
  .refine(
    (data) => {
      // Packeta point required for pickup
      if (data.shippingMethod === "packeta_pickup") {
        return !!data.packetaPointId;
      }
      return true;
    },
    {
      message: "Vyberte výdejní místo",
      path: ["packetaPointId"],
    }
  );

class UnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnavailableError";
  }
}

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  // 8 base-36 chars (4 bytes effective entropy, ~4.3 billion combinations) — prevents order URL enumeration
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8)
    .toUpperCase();
  return `JN-${y}${m}${d}-${rand}`;
}

/** Comgate method code for each online payment method.
 *  COD orders never reach Comgate — caller must guard before calling this. */
function getComgateMethod(method: PaymentMethod): string {
  switch (method) {
    case "card":
      return "CARD_CZ_CSOB_2";
    case "bank_transfer":
      return "BANK_ALL";
    case "cod":
      // COD should never reach Comgate — caller redirects before this point.
      // Throw to catch logic errors early instead of silently falling through.
      throw new Error("COD payment should not be sent to Comgate");
  }
}

export type CheckoutState = {
  error: string | null;
  fieldErrors: Record<string, string>;
  /**
   * Set when order is created successfully for inline card/express payment.
   * The client ComgatePaymentSection reads this and handles the inline iframe/SDK flow.
   * Not set for COD or bank transfer (those redirect immediately).
   */
  pendingPayment?: {
    orderNumber: string;
    accessToken: string;
  };
};

export async function createOrder(
  _prev: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  // Rate limit: 5 orders per 5 minutes per IP
  const rl = await rateLimitCheckout();
  if (!rl.success) {
    return {
      error: "Příliš mnoho pokusů o objednávku. Zkuste to prosím za chvíli.",
      fieldErrors: {},
    };
  }

  const itemsJson = formData.get("items") as string;
  if (!itemsJson || itemsJson.length > 50_000) {
    return { error: "Neplatná data košíku", fieldErrors: {} };
  }
  let items: Array<{
    productId: string;
    name: string;
    price: number;
    size: string;
    color: string;
    quantity: number;
  }>;
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Neplatná data košíku", fieldErrors: {} };
  }

  const raw = {
    email: formData.get("email") as string,
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    phone: (formData.get("phone") as string) || undefined,
    street: (formData.get("street") as string) || undefined,
    city: (formData.get("city") as string) || undefined,
    zip: (formData.get("zip") as string) || undefined,
    note: (formData.get("note") as string) || undefined,
    paymentMethod: formData.get("paymentMethod") as string,
    shippingMethod: formData.get("shippingMethod") as string,
    packetaPointId: (formData.get("packetaPointId") as string) || undefined,
    packetaPointName: (formData.get("packetaPointName") as string) || undefined,
    packetaPointAddress:
      (formData.get("packetaPointAddress") as string) || undefined,
    referralCode: (formData.get("referralCode") as string) || undefined,
    items,
  };

  const result = checkoutSchema.safeParse(raw);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: null, fieldErrors };
  }

  const data = result.data;
  const productIds = data.items.map((i) => i.productId);
  const visitorId = await getOrCreateVisitorId();
  const isCod = data.paymentMethod === "cod";
  const isPacketaPickup = data.shippingMethod === "packeta_pickup";

  // ─── PRE-TRANSACTION: read-only queries + non-critical upsert ───────────
  // These used to run inside the transaction, but Turso edge interactive
  // transactions pay one HTTP round-trip per statement. Moving non-atomic
  // work out of the tx shrinks the critical section from ~8 queries to 4-6
  // and avoids hitting the 5 s default interactive-tx timeout. Observed
  // prod error 2026-04-24 was 5505 ms.
  //
  // Safety: referral/store-credit checks are read-only (no race). Customer
  // upsert outside the tx is fine — a customer row without orders is
  // harmless, and if the downstream tx fails the user retries, the upsert
  // is idempotent.
  const db = await getDb();

  // Customer upsert (non-atomic — safe outside tx).
  let customer = await db.customer.findUnique({
    where: { email: data.email },
  });
  if (customer) {
    customer = await db.customer.update({
      where: { id: customer.id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.street
          ? { street: data.street, city: data.city, zip: data.zip }
          : {}),
      },
    });
  } else {
    customer = await db.customer.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
        street: data.street ?? null,
        city: data.city ?? null,
        zip: data.zip ?? null,
      },
    });
  }

  // Shipping/COD constants — pure arithmetic.
  const baseShipping = SHIPPING_PRICES[data.shippingMethod as ShippingMethod] ?? 0;
  const codFee = isCod ? COD_SURCHARGE : 0;

  // ─── PRE-TX read-only queries (run in parallel where possible) ────────
  // Fetch products + store-credit + referral validation in parallel. None
  // of these need to be inside the tx: products are read again inside the
  // tx for atomic availability/sold check, and credit/referral are verified
  // (and applied) in tx too — these are just precomputes so we know total
  // before opening the tx.
  const [prefetchProducts, availableCreditCzkPre] = await Promise.all([
    db.product.findMany({
      where: { id: { in: productIds }, active: true, sold: false },
    }),
    getAvailableStoreCredit(data.email),
  ]);
  const prefetchMap = new Map(prefetchProducts.map((p) => [p.id, p]));
  const subtotalPre = data.items.reduce((sum, i) => {
    const p = prefetchMap.get(i.productId);
    return sum + (p?.price ?? i.price);
  }, 0);
  let referralDiscountPre = 0;
  if (data.referralCode && subtotalPre >= REFERRAL_MIN_ORDER_CZK) {
    const rr = await validateReferralCode(data.referralCode, data.email);
    if (rr.valid) referralDiscountPre = rr.discountCzk;
  }

  // ─── TRANSACTION: atomic availability + order write ────────────────────
  // Now tx only does: re-verify availability (cheap, same products usually),
  // createOrder, createMany orderItems, updateMany products (sold flag),
  // applyStoreCredit, redeemReferralCode. No read-only precomputes.
  let order;
  try {
    order = await db.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, active: true, sold: false },
      });

      const now = new Date();
      const productMap = new Map(products.map((p) => [p.id, p]));
      const unavailable = data.items.filter((i) => {
        const p = productMap.get(i.productId);
        if (!p) return true;
        if (
          p.reservedUntil &&
          p.reservedUntil > now &&
          p.reservedBy !== visitorId
        ) {
          return true;
        }
        return false;
      });
      if (unavailable.length > 0) {
        const names = unavailable.map((i) => i.name).join(", ");
        throw new UnavailableError(
          `Tyto produkty už bohužel nejsou dostupné: ${names}. Odeberte je z košíku a zkuste to znovu.`
        );
      }

      // Authoritative server-side prices — re-read inside tx in case price
      // changed between precompute and now (rare but possible on manual admin
      // edit). Precompute is a fast-path that usually matches these.
      const subtotal = data.items.reduce((sum, i) => {
        const dbProduct = productMap.get(i.productId)!;
        return sum + dbProduct.price * 1;
      }, 0);
      const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : baseShipping;

      // Use precomputed referral discount (validated just above tx).
      // Cap the discount to the live subtotal guard in case price dropped.
      const referralDiscount =
        data.referralCode && subtotal >= REFERRAL_MIN_ORDER_CZK
          ? referralDiscountPre
          : 0;

      // Apply store credit (write path — must be inside tx).
      const preDiscountTotal = subtotal + shipping + codFee - referralDiscount;
      const maxCreditToApply = Math.min(availableCreditCzkPre, Math.max(0, preDiscountTotal));
      let storeCreditUsed = 0;
      if (maxCreditToApply > 0) {
        storeCreditUsed = await applyStoreCredit(tx, data.email, maxCreditToApply);
      }

      const total = Math.max(0, subtotal + shipping + codFee - referralDiscount - storeCreditUsed);

      const shippingName = `${data.firstName} ${data.lastName}`;
      const shippingStreet = isPacketaPickup
        ? (data.packetaPointName ?? null)
        : (data.street ?? null);
      const shippingCity = isPacketaPickup ? null : (data.city ?? null);
      const shippingZip = isPacketaPickup ? null : (data.zip ?? null);

      // Create order with DB-sourced prices
      const orderNumber = generateOrderNumber();
      const accessToken = crypto.randomUUID();
      // Czech law (§2159 NOZ): deliver within 30 days unless agreed otherwise
      const expectedDeliveryDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const created = await tx.order.create({
        data: {
          orderNumber,
          accessToken,
          customerId: customer.id,
          status: "pending",
          paymentMethod: data.paymentMethod,
          subtotal,
          shipping,
          total,
          note: data.note ?? null,
          shippingName,
          shippingStreet,
          shippingCity,
          shippingZip,
          shippingMethod: data.shippingMethod,
          shippingPointId: data.packetaPointId ?? null,
          expectedDeliveryDate,
          referralCode: referralDiscount > 0 ? data.referralCode : null,
          referralDiscount,
          storeCreditUsed,
        },
      });

      // Create order items — validate size/color against product DB data.
      // Reject invalid values instead of silently falling back — the customer
      // must consent to the exact size/color they're ordering.
      await tx.orderItem.createMany({
        data: data.items.map((item) => {
          const dbProduct = productMap.get(item.productId)!;
          const validatedSize = item.size;
          const validatedColor = item.color;
          try {
            const dbSizes: string[] = JSON.parse(dbProduct.sizes);
            if (dbSizes.length > 0 && !dbSizes.includes(item.size)) {
              throw new UnavailableError(
                `Velikost „${item.size}" není dostupná pro ${dbProduct.name}. Aktualizujte košík a zkuste to znovu.`
              );
            }
          } catch (e) {
            if (e instanceof UnavailableError) throw e;
            // Corrupted sizes JSON in DB — reject order rather than silently
            // accepting an unvalidated client value. Admin must fix the product.
            logger.error(`[Checkout] Corrupted sizes JSON for product ${dbProduct.id}: ${dbProduct.sizes}`);
            throw new UnavailableError(
              `Produkt „${dbProduct.name}" má poškozená data. Kontaktujte nás prosím.`
            );
          }
          try {
            const dbColors: string[] = JSON.parse(dbProduct.colors);
            if (dbColors.length > 0 && item.color && !dbColors.includes(item.color)) {
              throw new UnavailableError(
                `Barva „${item.color}" není dostupná pro ${dbProduct.name}. Aktualizujte košík a zkuste to znovu.`
              );
            }
          } catch (e) {
            if (e instanceof UnavailableError) throw e;
            logger.error(`[Checkout] Corrupted colors JSON for product ${dbProduct.id}: ${dbProduct.colors}`);
            throw new UnavailableError(
              `Produkt „${dbProduct.name}" má poškozená data. Kontaktujte nás prosím.`
            );
          }
          return {
            orderId: created.id,
            productId: item.productId,
            name: dbProduct.name,
            price: dbProduct.price,
            quantity: 1,
            size: validatedSize,
            color: validatedColor,
          };
        }),
      });

      // Mark products as sold and clear reservations (second-hand: each piece is unique)
      await tx.product.updateMany({
        where: { id: { in: productIds } },
        data: { sold: true, stock: 0, reservedUntil: null, reservedBy: null },
      });

      // Redeem referral code if one was applied
      if (referralDiscount > 0 && data.referralCode) {
        await redeemReferralCode(tx, data.referralCode.trim().toUpperCase(), orderNumber);
      }

      // Collect DB prices, names, slugs, and SKUs for email + ISR + Heureka
      const dbPrices = new Map(products.map((p) => [p.id, p.price]));
      const dbNames = new Map(products.map((p) => [p.id, p.name]));
      const productSlugs = products.map((p) => p.slug);
      const productSkus = products.map((p) => p.sku);
      // Sold product data for similar-item notification emails
      const soldProducts = products.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        categoryId: p.categoryId,
        sizes: p.sizes,
        images: p.images,
      }));
      return {
        ...created,
        customerEmail: customer.email,
        dbPrices,
        dbNames,
        productSlugs,
        productSkus,
        soldProducts,
        referralDiscountApplied: referralDiscount,
        storeCreditApplied: storeCreditUsed,
      };
    });
  } catch (e) {
    if (e instanceof UnavailableError) {
      return { error: e.message, fieldErrors: {} };
    }
    throw e;
  }

  // Revalidate ISR cache for sold product pages — with 3600s ISR, sold items
  // would show as available for up to 1 hour without immediate invalidation
  for (const slug of order.productSlugs) {
    revalidatePath(`/products/${slug}`);
  }
  revalidatePath("/products");
  revalidatePath("/");
  revalidateTag("products", "max");
  // New order lands in the admin sidebar's "last 24h" badge — drop the cached
  // trio so the next admin nav reflects it (see src/lib/admin-badges.ts).
  revalidateTag("admin-badges", "max");
  // Drop Redis copies so the next request doesn't serve a sold item as available.
  await Promise.all(
    order.productSlugs.map((slug) => invalidateProductCaches({ slug })),
  );

  // Generate a referral code for this order (fire-and-forget)
  createReferralCode(order.orderNumber, order.customerEmail).catch((e) =>
    logger.error("[Checkout] Referral code generation failed:", e),
  );

  // Notify subscribers about similar items when their watched category sells (fire-and-forget)
  sendSimilarItemNotifications(order.soldProducts).catch((e) =>
    logger.error("[Checkout] Similar notify:", e),
  );

  // Notify wishlist subscribers that their saved item just sold (fire-and-forget)
  sendWishlistSoldNotifications(order.soldProducts).catch((e) =>
    logger.error("[Checkout] Wishlist sold notify:", e),
  );

  // P4.2: Enqueue order confirmation email on BullMQ (fire-and-forget).
  // Enqueue returns in ~5ms regardless of queue depth; worker sends via Resend.
  // Falls back to inline send if REDIS_URL is unset (dev / preview).
  dispatchEmail(
    "order-confirmation",
    {
      orderNumber: order.orderNumber,
      customerName: `${data.firstName} ${data.lastName}`,
      customerEmail: order.customerEmail,
      items: data.items.map((item) => {
        const dbPrice = order.dbPrices.get(item.productId);
        const dbName = order.dbNames.get(item.productId);
        if (dbPrice === undefined || dbName === undefined) {
          logger.error(`[Checkout] Missing DB data for product ${item.productId} in email`);
        }
        return { name: dbName ?? item.name, price: dbPrice ?? item.price, size: item.size, color: item.color };
      }),
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
      paymentMethod: isCod ? "cod" : (data.paymentMethod as string),
      shippingMethod: data.shippingMethod,
      shippingName: `${data.firstName} ${data.lastName}`,
      shippingStreet: isPacketaPickup ? (data.packetaPointName ?? null) : (data.street ?? null),
      shippingCity: isPacketaPickup ? null : (data.city ?? null),
      shippingZip: isPacketaPickup ? null : (data.zip ?? null),
      shippingPointId: data.packetaPointId ?? null,
      note: data.note ?? null,
      accessToken: order.accessToken ?? "",
      isCod,
      expectedDeliveryDate: order.expectedDeliveryDate ?? null,
    },
    sendOrderConfirmationEmail,
  ).catch((err: unknown) => {
    logger.error(`[Checkout] Order confirmation dispatch failed for ${order.orderNumber}:`, err);
  });

  // Notify admin about new order — COD only fires here (confirmed money).
  // Online payments (Comgate) notify admin from the webhook once status=PAID,
  // so unpaid pending orders don't spam admin inbox.
  if (isCod) {
    dispatchEmail(
      "admin-new-order",
      {
        orderNumber: order.orderNumber,
        orderId: order.id,
        customerName: `${data.firstName} ${data.lastName}`,
        customerEmail: order.customerEmail,
        items: data.items.map((item) => {
          const dbPrice = order.dbPrices.get(item.productId);
          const dbName = order.dbNames.get(item.productId);
          return { name: dbName ?? item.name, price: dbPrice ?? item.price, size: item.size, color: item.color };
        }),
        total: order.total,
        paymentMethod: data.paymentMethod,
        shippingMethod: data.shippingMethod,
      },
      sendAdminNewOrderEmail,
    ).catch((err: unknown) => {
      logger.error(`[Checkout] Admin notification dispatch failed for ${order.orderNumber}:`, err);
    });
  }

  // For cash on delivery — mark abandoned carts recovered, log to Heureka, then go to confirmation
  if (isCod) {
    db.abandonedCart
      .updateMany({
        where: { email: data.email, status: "pending" },
        data: { status: "recovered", recoveredOrderId: order.id },
      })
      .catch((err: unknown) => {
        logger.error("[Checkout] Failed to mark abandoned carts as recovered:", err);
      });

    // Log to Heureka for "Ověřeno zákazníky" review questionnaire (fire-and-forget)
    logOrderToHeureka(
      order.customerEmail,
      order.orderNumber,
      order.productSkus,
    ).catch((err) => {
      logger.error(`[Checkout] Heureka ORDER_INFO failed for ${order.orderNumber}:`, err);
    });

    redirect(`/order/${order.orderNumber}?token=${order.accessToken}`);
  }

  // Mark abandoned carts recovered (fire-and-forget — same for all online methods)
  db.abandonedCart
    .updateMany({
      where: { email: data.email, status: "pending" },
      data: { status: "recovered", recoveredOrderId: order.id },
    })
    .catch((err: unknown) => {
      logger.error("[Checkout] Failed to mark abandoned carts as recovered:", err);
    });

  const provider = getPaymentProvider();

  // ---------------------------------------------------------------------------
  // CARD payment — inline iframe flow (Comgate only).
  // For mock/gopay, card falls through to the server-redirect flow below (the
  // inline iframe is Comgate-specific; mock renders its own /checkout/mock-payment page).
  // ---------------------------------------------------------------------------
  if (data.paymentMethod === "card" && provider.name === "comgate") {
    return {
      error: null,
      fieldErrors: {},
      pendingPayment: {
        orderNumber: order.orderNumber,
        accessToken: order.accessToken ?? "",
      },
    };
  }

  // ---------------------------------------------------------------------------
  // BANK TRANSFER (or card on mock/gopay) — create payment server-side and redirect.
  // redirect() must be OUTSIDE try-catch to avoid catching Next.js redirect signals.
  // ---------------------------------------------------------------------------
  let paymentRedirectUrl: string;
  try {
    const payment = await provider.createPayment({
      refId: order.orderNumber,
      priceCzk: order.total,
      email: order.customerEmail,
      label: `Janička #${order.orderNumber.slice(-8)}`,
      method:
        provider.name === "comgate"
          ? getComgateMethod(data.paymentMethod)
          : data.paymentMethod,
      accessToken: order.accessToken ?? undefined,
    });

    // Store Comgate transaction ID on the order
    await db.order.update({
      where: { id: order.id },
      data: { paymentId: payment.transId },
    });

    paymentRedirectUrl = payment.redirect;
  } catch (e) {
    // Comgate payment creation failed — rollback the order and un-sell products.
    // Without rollback, products stay sold:true and the user can't retry checkout
    // (neither online payment nor COD — both would fail on availability check).
    try {
      await db.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: order.id } });
        await tx.order.delete({ where: { id: order.id } });
        await tx.product.updateMany({
          where: { id: { in: productIds }, active: true, sold: true },
          data: { sold: false, stock: 1 },
        });
      });
    } catch (rollbackErr) {
      logger.error(
        "[Checkout] Failed to rollback order after payment failure:",
        rollbackErr
      );
    }
    logger.error("[Checkout] Comgate payment creation failed:", e);
    return {
      error:
        "Nepodařilo se vytvořit platbu. Zkuste to prosím znovu nebo zvolte platbu na dobírku.",
      fieldErrors: {},
    };
  }

  redirect(paymentRedirectUrl);
}

// ---------------------------------------------------------------------------
// Checkout discount validation — called from client for preview
// ---------------------------------------------------------------------------

export async function validateCheckoutDiscounts(input: {
  referralCode: string | null;
  email: string | null;
}): Promise<{
  referralDiscount: number;
  referralCode: string | null;
  referralError: string | null;
  storeCredit: number;
}> {
  return getCheckoutDiscounts(input.referralCode, input.email);
}

// ---------------------------------------------------------------------------
// Abandoned cart capture — called on email blur during checkout
// ---------------------------------------------------------------------------

const abandonedCartSchema = z.object({
  email: z.string().email().max(254),
  customerName: z.string().max(200).optional(),
  cartItems: z
    .array(
      z.object({
        productId: z.string().max(128),
        name: z.string().max(300),
        price: z.number().finite().nonnegative(),
        size: z.string().max(50).optional(),
        color: z.string().max(50).optional(),
        image: z.string().max(2000).optional(),
        slug: z.string().max(300).optional(),
      })
    )
    .min(1)
    .max(50),
  cartTotal: z.number().finite().nonnegative(),
  marketingConsent: z.boolean().default(false),
});

/**
 * Capture cart state server-side when customer enters their email at checkout.
 * Used to power abandoned cart recovery emails (30-60min, 12-24h, 48-72h).
 * Deduplicates by email — updates existing pending record instead of creating duplicates.
 */
export async function captureAbandonedCart(input: {
  email: string;
  customerName?: string;
  cartItems: {
    productId: string;
    name: string;
    price: number;
    size?: string;
    color?: string;
    image?: string;
    slug?: string;
  }[];
  cartTotal: number;
  marketingConsent?: boolean;
}): Promise<void> {
  const parsed = abandonedCartSchema.safeParse(input);
  if (!parsed.success) return; // silently ignore invalid data

  const { email, customerName, cartItems, cartTotal, marketingConsent } = parsed.data;

  try {
    const db = await getDb();
    const visitorId = await getOrCreateVisitorId();

    // Dedup: find existing pending abandoned cart for this email
    const existing = await db.abandonedCart.findFirst({
      where: { email, status: "pending" },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      // Update existing record with latest cart state
      await db.abandonedCart.update({
        where: { id: existing.id },
        data: {
          customerName: customerName ?? existing.customerName,
          cartItems: JSON.stringify(cartItems),
          cartTotal,
          visitorId,
          pageUrl: "/checkout",
          marketingConsent,
        },
      });
    } else {
      await db.abandonedCart.create({
        data: {
          email,
          customerName,
          cartItems: JSON.stringify(cartItems),
          cartTotal,
          visitorId,
          pageUrl: "/checkout",
          marketingConsent,
        },
      });
    }
  } catch (err) {
    // Never block checkout flow — log and move on
    logger.error("[AbandonedCart] Capture failed:", err);
  }
}
