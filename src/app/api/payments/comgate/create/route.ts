import { NextRequest, NextResponse, connection } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { createComgatePayment } from "@/lib/payments/comgate";
import { ComgateError } from "@/lib/payments/types";


/**
 * POST /api/payments/comgate/create
 *
 * Creates a Comgate payment for the inline flow (card iframe / Apple Pay / Google Pay).
 * Called client-side from ComgatePaymentSection after order is created by the server action.
 *
 * Returns:
 * - transactionId — Comgate transId (used by SDK for Apple/Google Pay)
 * - redirect — Comgate iframe URL (used as iframe src for card payments)
 * - embedded — whether this is an inline iframe payment
 */

const requestSchema = z.object({
  orderNumber: z.string().min(1).max(64).regex(/^JN-/),
  method: z.enum(["CARD", "APPLE_PAY", "GOOGLE_PAY"]),
  accessToken: z.string().min(1).max(256),
});

// Comgate method codes per payment type
const COMGATE_METHOD_CODES: Record<string, string> = {
  CARD: "CARD_CZ_CSOB_2",
  APPLE_PAY: "CARD_CZ_CSOB_2", // Apple/Google Pay use same card method code — SDK handles button UI
  GOOGLE_PAY: "CARD_CZ_CSOB_2",
};

export async function POST(req: NextRequest) {
  await connection();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatná data požadavku" },
      { status: 400 }
    );
  }

  const { orderNumber, method, accessToken } = parsed.data;

  const db = await getDb();
  const order = await db.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      accessToken: true,
      paymentId: true,
      paymentMethodAttempt: true,
      paymentRedirect: true,
      customer: { select: { email: true } },
    },
  });

  // Return generic 403 for both missing and token-mismatch to prevent enumeration
  if (!order || order.accessToken !== accessToken) {
    return NextResponse.json({ error: "Přístup odepřen" }, { status: 403 });
  }

  if (order.status !== "pending") {
    return NextResponse.json(
      { error: "Objednávka již byla zpracována" },
      { status: 400 }
    );
  }

  // Reuse existing transId only when the payment method matches the stored attempt.
  // When method changes (e.g. bank transfer → card, or card → Apple Pay), the original
  // redirect URL is wrong for the new method — we must create a fresh Comgate transaction.
  if (order.paymentId && order.paymentRedirect && order.paymentMethodAttempt === method) {
    return NextResponse.json({
      transactionId: order.paymentId,
      redirect: order.paymentRedirect,
      embedded: method === "CARD",
      reused: true,
    });
  }

  try {
    const payment = await createComgatePayment({
      refId: order.orderNumber,
      priceCzk: order.total,
      email: order.customer.email,
      label: `Janička #${order.orderNumber.slice(-8)}`,
      method: COMGATE_METHOD_CODES[method] ?? "CARD_CZ_CSOB_2",
      accessToken: order.accessToken ?? undefined,
      embedded: method === "CARD",
    });

    // Store transId, redirect URL, and method attempt on order so retries with the
    // same method can be idempotent, and retries with a different method trigger a
    // fresh Comgate transaction (the redirect URL differs per method / embedded flag).
    await db.order.update({
      where: { id: order.id },
      data: {
        paymentId: payment.transId,
        paymentRedirect: payment.redirect,
        paymentMethodAttempt: method,
      },
    });

    return NextResponse.json({
      transactionId: payment.transId,
      redirect: payment.redirect,
      embedded: method === "CARD",
    });
  } catch (e) {
    if (e instanceof ComgateError) {
      console.error(
        `[Comgate create] API error ${e.code}: ${e.message} for order ${orderNumber}`
      );
      return NextResponse.json(
        {
          error:
            "Platební brána momentálně nedostupná. Zkuste to prosím znovu nebo zvolte platbu na dobírku.",
        },
        { status: 502 }
      );
    }
    console.error(`[Comgate create] Unexpected error for order ${orderNumber}:`, e);
    return NextResponse.json(
      { error: "Nepodařilo se vytvořit platbu. Zkuste to prosím znovu." },
      { status: 500 }
    );
  }
}
