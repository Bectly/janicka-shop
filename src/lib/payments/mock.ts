import {
  type CreatePaymentParams,
  type CreatePaymentResult,
  type PaymentProvider,
  type PaymentStatusResult,
  type ComgatePaymentStatus,
} from "./types";

/**
 * Mock payment provider — for end-to-end testing without a real payment gateway.
 *
 * Flow:
 * 1. createPayment() generates a fake transId ("mock-...") and returns a redirect URL
 *    to /checkout/mock-payment?ref={orderNumber}&token={accessToken}
 * 2. The mock payment page shows a test card form. User clicks Pay or Decline.
 * 3. /api/payments/mock/confirm advances the order to paid/cancelled and triggers
 *    the same side effects as a real Comgate webhook.
 *
 * Status is tracked in-memory per process — sufficient for dev / preview because
 * the mock confirm endpoint writes the final state directly to the order row.
 *
 * NEVER enable in production (provider factory guards against NODE_ENV=production).
 */

const statusMap = new Map<string, ComgatePaymentStatus>();

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    `http://localhost:${process.env.PORT ?? "3000"}`
  );
}

function genTransId(): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `mock-${rand}`;
}

async function createPayment(
  params: CreatePaymentParams,
): Promise<CreatePaymentResult> {
  const transId = genTransId();
  statusMap.set(transId, "PENDING");

  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams({
    ref: params.refId,
    trans: transId,
    ...(params.accessToken ? { token: params.accessToken } : {}),
  });
  const redirect = `${baseUrl}/checkout/mock-payment?${qs.toString()}`;
  return { transId, redirect };
}

async function getPaymentStatus(transId: string): Promise<PaymentStatusResult> {
  const status = statusMap.get(transId) ?? "PENDING";
  return {
    merchant: "MOCK",
    test: true,
    price: 0,
    curr: "CZK",
    label: "mock",
    refId: transId,
    method: "MOCK",
    email: "",
    transId,
    status,
  };
}

async function refundPayment(transId: string): Promise<void> {
  statusMap.set(transId, "CANCELLED");
}

/** Called by /api/payments/mock/confirm to advance transaction state. */
export function setMockStatus(transId: string, status: ComgatePaymentStatus): void {
  statusMap.set(transId, status);
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  createPayment,
  getPaymentStatus,
  refundPayment,
};
