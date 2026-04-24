import { type PaymentProvider } from "./types";
import {
  createComgatePayment,
  getComgatePaymentStatus,
  refundComgatePayment,
} from "./comgate";
import { mockProvider } from "./mock";
import { gopayProvider } from "./gopay";

/**
 * Provider factory. Reads PAYMENT_PROVIDER env var (defaults to "comgate").
 *
 * Valid values: "comgate" (default), "mock" (dev/preview only), "gopay" (stub).
 *
 * IMPORTANT: mock provider is refused in production — an operator who forgot to
 * set PAYMENT_PROVIDER on Vercel should not accidentally ship a no-charge checkout.
 */

const comgateProvider: PaymentProvider = {
  name: "comgate",
  createPayment: createComgatePayment,
  getPaymentStatus: getComgatePaymentStatus,
  refundPayment: refundComgatePayment,
};

export function getPaymentProvider(): PaymentProvider {
  const selected = (process.env.PAYMENT_PROVIDER ?? "comgate").toLowerCase();

  if (selected === "mock" && process.env.NODE_ENV === "production") {
    throw new Error(
      "PAYMENT_PROVIDER=mock is not allowed in production. " +
        "Set PAYMENT_PROVIDER=comgate (or gopay when integration ships).",
    );
  }

  switch (selected) {
    case "mock":
      return mockProvider;
    case "gopay":
      return gopayProvider;
    case "comgate":
      return comgateProvider;
    default:
      console.warn(
        `[Payments] Unknown PAYMENT_PROVIDER="${selected}", falling back to comgate`,
      );
      return comgateProvider;
  }
}

export function getPaymentProviderName(): PaymentProvider["name"] {
  return getPaymentProvider().name;
}
