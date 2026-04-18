"use client";

/**
 * Express checkout buttons (Apple Pay / Google Pay) placed at top of checkout
 * and on cart page for maximum conversion.
 *
 * C1496: express at top = 2x mobile conversion (Stripe 150k+ sessions).
 * Apple Pay: +22.3% conversion, +22.5% revenue.
 *
 * Graceful no-op when NEXT_PUBLIC_COMGATE_CHECKOUT_ID is not set — renders nothing.
 * Device detection uses native browser APIs (no Comgate SDK needed pre-order).
 * Real Apple Pay / Google Pay SDK mounting happens in ComgatePaymentSection after order creation.
 */

import { useEffect, useState } from "react";

interface Props {
  /** Called when user clicks an express button */
  onSelect?: (method: "apple_pay" | "google_pay") => void;
}

const COMGATE_CONFIGURED = !!process.env.NEXT_PUBLIC_COMGATE_CHECKOUT_ID;

export function ExpressCheckoutButtons({ onSelect }: Props) {
  const [supports, setSupports] = useState<{
    apple: boolean;
    google: boolean;
  } | null>(null);

  useEffect(() => {
    if (!COMGATE_CONFIGURED) {
      setSupports({ apple: false, google: false });
      return;
    }

    let apple = false;
    let google = false;

    // Apple Pay: native browser API (works without SDK)
    try {
      const w = window as Window & {
        ApplePaySession?: { canMakePayments?(): boolean };
      };
      if (w.ApplePaySession?.canMakePayments?.()) apple = true;
    } catch {
      /* not supported */
    }

    // Google Pay: heuristic — non-Apple browser with Payment Request API
    try {
      if (!("ApplePaySession" in window) && "PaymentRequest" in window) {
        google = true;
      }
    } catch {
      /* not supported */
    }

    setSupports({ apple, google });
  }, []);

  // Graceful no-op: nothing renders if not configured or no express methods
  if (!supports || (!supports.apple && !supports.google)) return null;

  return (
    <div className="space-y-3">
      {supports.apple && (
        <button
          type="button"
          onClick={() => onSelect?.("apple_pay")}
          className="flex min-h-12 w-full items-center justify-center gap-1 rounded-lg bg-black text-white transition-opacity duration-150 hover:opacity-90"
          aria-label="Zaplatit přes Apple Pay"
        >
          <AppleLogo className="h-5 w-auto" />
          <span className="text-[17px] font-medium tracking-tight">Pay</span>
        </button>
      )}

      {supports.google && (
        <button
          type="button"
          onClick={() => onSelect?.("google_pay")}
          className="flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-[#dadce0] bg-white transition-colors duration-150 hover:bg-[#f8f9fa]"
          aria-label="Zaplatit přes Google Pay"
        >
          <GooglePayWordmark className="h-[22px] w-auto" />
        </button>
      )}

      <div className="relative flex items-center gap-3 py-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">nebo</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Brand marks (inline SVGs — no external assets needed)                     */
/* -------------------------------------------------------------------------- */

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 814 1000"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57.5-155.5-127.7C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8.7 15.6 1.3 18.2 2.6.5 6.4.6 10.2.6 45.9 0 103.6-30.3 139.5-70.7z" />
    </svg>
  );
}

function GooglePayWordmark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 435 173" aria-hidden="true">
      <path
        d="M206.2 84.5v50.8h-16.1V10h42.7c10.3-.2 20.2 3.7 27.7 10.9 7.5 6.8 11.7 16.6 11.5 26.7.2 10.2-4 20-11.5 26.9-7.5 7.1-16.7 10.7-27.5 10.7h-26.8v-.7zm0-59.1v43.7h27.1c6.2.2 12.1-2.2 16.5-6.7 8.8-8.8 9-23.2.3-32.2l-.3-.3c-4.3-4.6-10.4-7.1-16.5-6.8h-27.1v2.3zM329.5 50.5c11.8 0 21.1 3.2 27.9 9.5 6.8 6.3 10.2 15 10.2 25.9v52.4h-15.4v-11.8h-.7c-6.6 9.6-15.3 14.4-26.2 14.4-9.3 0-17.1-2.8-23.4-8.3-6.1-5.2-9.5-12.7-9.3-20.6 0-8.7 3.3-15.6 9.8-20.7 6.6-5.1 15.3-7.7 26.3-7.7 9.3 0 17 1.7 23 5.2V85c.2-6.1-2.6-12-7.5-15.8-5-4-10.9-6.2-17.2-6.2-10 0-17.9 4.2-23.7 12.7l-14.2-8.9c8.6-12.5 21.3-18.7 38.4-16.3zM310 125.1c4.7 3.8 10.5 5.9 16.5 5.8 6.6 0 12.8-2.6 17.5-7.2 5.2-4.6 7.8-10.2 7.8-16.7-4.8-4-11.5-6-20.2-6-6.4 0-11.7 1.6-16 4.7-4.3 3.2-6.5 7.1-6.5 11.7.1 3 1.3 5.9 3.5 7.8l-2.6-.1zM430.2 53.5l-53.7 123.3h-16.6l19.9-43.4-35.3-79.9h17.5l25.5 61.6h.3l24.8-61.6h17.6z"
        fill="#3c4043"
      />
      <path
        d="M142.1 73.6c0-4.9-.4-9.8-1.2-14.6H73v27.7h38.9c-1.6 8.9-6.8 16.9-14.4 21.8v17.7h23.1c13.6-12.5 21.5-31 21.5-52.6z"
        fill="#4285F4"
      />
      <path
        d="M73 143.3c19.4 0 35.8-6.4 47.7-17.4l-23.1-17.7c-6.5 4.4-14.8 6.9-24.6 6.9-18.8 0-34.8-12.7-40.5-29.8H8.6v18.3c12.2 24.3 37 39.7 64.4 39.7z"
        fill="#34A853"
      />
      <path
        d="M32.5 85.3c-3-8.9-3-18.5 0-27.4V39.6H8.6C-.6 56-.6 75.4 8.6 91.8l23.9-6.5z"
        fill="#FBBC04"
      />
      <path
        d="M73 28.1c10.3-.2 20.2 3.7 27.6 10.8l20.5-20.5C108.1 6.5 91.1-.2 73.4 0 45.9 0 21.2 15.5 8.6 39.6l23.9 18.3C38.2 40.8 54.2 28.1 73 28.1z"
        fill="#EA4335"
      />
    </svg>
  );
}
