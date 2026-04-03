import {
  ComgateError,
  COMGATE_STATUSES,
  type CreatePaymentParams,
  type CreatePaymentResult,
  type ComgatePaymentStatus,
  type PaymentStatusResult,
} from "./types";

const COMGATE_API_URL = "https://payments.comgate.cz/v1.0";
const COMGATE_TIMEOUT_MS = 15_000;

function getConfig() {
  const merchant = process.env.COMGATE_MERCHANT_ID;
  const secret = process.env.COMGATE_SECRET;
  if (!merchant || !secret) {
    throw new Error(
      "Missing COMGATE_MERCHANT_ID or COMGATE_SECRET environment variables",
    );
  }
  return {
    merchant,
    secret,
    test: process.env.COMGATE_TEST === "true",
  };
}

function getBaseUrl(): string {
  // In production, use NEXT_PUBLIC_APP_URL; in dev, construct from headers
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    `http://localhost:${process.env.PORT ?? "3000"}`
  );
}

/** Parse URL-encoded response body from Comgate API */
function parseResponse(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

/**
 * Create a new payment via Comgate REST API.
 * Returns transId and redirect URL for the customer.
 */
export async function createComgatePayment(
  params: CreatePaymentParams,
): Promise<CreatePaymentResult> {
  const config = getConfig();
  const baseUrl = getBaseUrl();

  const body = new URLSearchParams({
    merchant: config.merchant,
    secret: config.secret,
    test: config.test ? "true" : "false",
    country: "CZ",
    price: Math.round(params.priceCzk * 100).toString(), // CZK → hellers
    curr: "CZK",
    label: params.label.slice(0, 16),
    refId: params.refId,
    method: params.method ?? "ALL",
    email: params.email,
    lang: "cs",
    prepareOnly: "true",
    url: `${baseUrl}/checkout/payment-return?refId=${encodeURIComponent(params.refId)}${params.accessToken ? `&token=${encodeURIComponent(params.accessToken)}` : ""}`,
    notifUrl: `${baseUrl}/api/payments/comgate`,
  });

  const res = await fetch(`${COMGATE_API_URL}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(COMGATE_TIMEOUT_MS),
  });

  const text = await res.text();
  const data = parseResponse(text);

  if (data.code !== "0") {
    throw new ComgateError(
      parseInt(data.code ?? "999", 10),
      data.message ?? "Unknown Comgate error",
    );
  }

  if (!data.transId || !data.redirect) {
    throw new ComgateError(999, "Missing transId or redirect in response");
  }

  return {
    transId: data.transId,
    redirect: data.redirect,
  };
}

/**
 * Check payment status via Comgate REST API.
 * Always use this to verify webhook notifications — never trust webhook payload alone.
 */
export async function getComgatePaymentStatus(
  transId: string,
): Promise<PaymentStatusResult> {
  const config = getConfig();

  const body = new URLSearchParams({
    merchant: config.merchant,
    secret: config.secret,
    transId,
  });

  const res = await fetch(`${COMGATE_API_URL}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(COMGATE_TIMEOUT_MS),
  });

  const text = await res.text();
  const data = parseResponse(text);

  if (data.code !== "0") {
    throw new ComgateError(
      parseInt(data.code ?? "999", 10),
      data.message ?? "Unknown Comgate error",
    );
  }

  const status = data.status;
  if (!COMGATE_STATUSES.includes(status as ComgatePaymentStatus)) {
    throw new ComgateError(999, `Unknown Comgate payment status: ${status}`);
  }

  return {
    merchant: data.merchant,
    test: data.test === "true",
    price: parseInt(data.price, 10),
    curr: data.curr,
    label: data.label,
    refId: data.refId,
    method: data.method,
    email: data.email,
    transId: data.transId,
    status: status as ComgatePaymentStatus,
  };
}

/**
 * Refund a payment (full or partial).
 * Amount is in CZK — pass undefined for full refund.
 */
export async function refundComgatePayment(
  transId: string,
  amountCzk?: number,
): Promise<void> {
  const config = getConfig();

  const body = new URLSearchParams({
    merchant: config.merchant,
    secret: config.secret,
    transId,
  });

  if (amountCzk !== undefined) {
    body.set("amount", Math.round(amountCzk * 100).toString());
  }

  const res = await fetch(`${COMGATE_API_URL}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(COMGATE_TIMEOUT_MS),
  });

  const text = await res.text();
  const data = parseResponse(text);

  if (data.code !== "0") {
    throw new ComgateError(
      parseInt(data.code ?? "999", 10),
      data.message ?? "Refund failed",
    );
  }
}
