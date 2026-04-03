/** Comgate payment statuses */
export const COMGATE_STATUSES = ["PENDING", "PAID", "CANCELLED", "AUTHORIZED"] as const;
export type ComgatePaymentStatus = (typeof COMGATE_STATUSES)[number];

/** Parameters for creating a Comgate payment */
export interface CreatePaymentParams {
  /** Our order reference (e.g. order number) */
  refId: string;
  /** Total price in CZK (will be converted to hellers internally) */
  priceCzk: number;
  /** Customer email */
  email: string;
  /** Payment description shown on bank statement (max 16 chars) */
  label: string;
  /** Preferred payment method — "ALL" for all available */
  method?: string;
  /** Order access token — included in return URL to prevent token leakage */
  accessToken?: string;
}

/** Successful create payment response */
export interface CreatePaymentResult {
  transId: string;
  redirect: string;
}

/** Payment status response from Comgate */
export interface PaymentStatusResult {
  merchant: string;
  test: boolean;
  price: number;
  curr: string;
  label: string;
  refId: string;
  method: string;
  email: string;
  transId: string;
  status: ComgatePaymentStatus;
}

/** Comgate API error */
export class ComgateError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = "ComgateError";
  }
}
