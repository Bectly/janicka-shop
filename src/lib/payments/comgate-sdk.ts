"use client";

/**
 * Comgate SDK wrapper — all @comgate/checkout-js calls go through here.
 *
 * IMPORTANT: When Comgate ships v3 (deprecation warning issued for current v2.0.15),
 * ONLY THIS FILE needs updating. Never import @comgate/checkout-js directly elsewhere.
 *
 * The SDK is a script loader: it injects external scripts from Comgate CDN at runtime.
 * Core / Apple Pay / Google Pay modules are loaded lazily — never at module level.
 * Do NOT call any of these functions in Server Components or at SSR time.
 */

import { loadComgateCheckout, VERSION_2 } from "@comgate/checkout-js";
import { logger } from "@/lib/logger";

export interface ComgatePaymentCallbacks {
  onPaid: (data: unknown) => void;
  onCancelled: () => void;
  onError: (error: unknown) => void;
}

export interface ComgateExpressPayOptions {
  mountElement: HTMLElement;
  callbacks: ComgatePaymentCallbacks;
  /** For Apple Pay: called when button clicked; return false to cancel */
  onButtonClick?: () => boolean;
}

// Singleton promise — SDK loads once per page lifecycle
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let checkoutPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCheckout(): Promise<any> {
  if (!checkoutPromise) {
    const checkoutId = process.env.NEXT_PUBLIC_COMGATE_CHECKOUT_ID;
    if (!checkoutId) {
      throw new Error("[Comgate SDK] NEXT_PUBLIC_COMGATE_CHECKOUT_ID not set");
    }
    checkoutPromise = loadComgateCheckout({
      checkoutId,
      version: VERSION_2,
      modules: ["applepay", "googlepay"],
      timeout: 15_000,
    });
  }
  return checkoutPromise;
}

/**
 * Mount Apple Pay button into mountElement.
 * Returns true if Apple Pay is available on this device/browser.
 */
export async function initComgateApplePay(
  transactionId: string,
  opts: ComgateExpressPayOptions
): Promise<boolean> {
  try {
    const checkout = await getCheckout();
    if (!checkout?.core || !checkout?.applepay) {
      logger.warn("[Comgate SDK] Apple Pay module not loaded");
      return false;
    }

    const core = checkout.core.create({
      transactionId,
      onPaid: opts.callbacks.onPaid,
      onCancelled: opts.callbacks.onCancelled,
      onError: opts.callbacks.onError,
    });

    const applePay = checkout.applepay.create(core, {
      ui: { type: "pay", color: "black" },
      ...(opts.onButtonClick
        ? { actions: { onButtonClick: opts.onButtonClick } }
        : {}),
    });

    const canPay: boolean = await applePay.canMakePayments();
    if (canPay) {
      applePay.mount(opts.mountElement);
    }
    return canPay;
  } catch (e) {
    logger.error("[Comgate SDK] Apple Pay init error:", e);
    return false;
  }
}

/**
 * Mount Google Pay button into mountElement.
 * Returns true if Google Pay is available on this device/browser.
 */
export async function initComgateGooglePay(
  transactionId: string,
  opts: ComgateExpressPayOptions
): Promise<boolean> {
  try {
    const checkout = await getCheckout();
    if (!checkout?.core || !checkout?.googlepay) {
      logger.warn("[Comgate SDK] Google Pay module not loaded");
      return false;
    }

    const core = checkout.core.create({
      transactionId,
      onPaid: opts.callbacks.onPaid,
      onCancelled: opts.callbacks.onCancelled,
      onError: opts.callbacks.onError,
    });

    const googlePay = checkout.googlepay.create(core, {
      ui: { type: "pay", color: "black" },
    });

    const canPay: boolean = await googlePay.canMakePayments();
    if (canPay) {
      googlePay.mount(opts.mountElement);
    }
    return canPay;
  } catch (e) {
    logger.error("[Comgate SDK] Google Pay init error:", e);
    return false;
  }
}

/** True if the SDK is configured (NEXT_PUBLIC_COMGATE_CHECKOUT_ID is set). */
export function isComgateCheckoutConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_COMGATE_CHECKOUT_ID;
}
