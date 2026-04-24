import {
  PaymentNotImplementedError,
  type CreatePaymentParams,
  type CreatePaymentResult,
  type PaymentProvider,
  type PaymentStatusResult,
} from "./types";

/**
 * GoPay provider — placeholder stub.
 *
 * GoPay will replace Comgate as the primary CZ payment gateway. Until the
 * integration lands, every method throws PaymentNotImplementedError so that
 * mis-configured environments fail loudly instead of silently dropping orders.
 */

async function createPayment(
  _params: CreatePaymentParams,
): Promise<CreatePaymentResult> {
  throw new PaymentNotImplementedError("GoPay integration pending");
}

async function getPaymentStatus(_transId: string): Promise<PaymentStatusResult> {
  throw new PaymentNotImplementedError("GoPay integration pending");
}

async function refundPayment(_transId: string, _amountCzk?: number): Promise<void> {
  throw new PaymentNotImplementedError("GoPay integration pending");
}

export const gopayProvider: PaymentProvider = {
  name: "gopay",
  createPayment,
  getPaymentStatus,
  refundPayment,
};
