"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

/**
 * Polls order status every 15 seconds for pending online payments.
 * When status changes to "paid", shows a success message and redirects
 * to the order confirmation page.
 *
 * CZ context: 50% of bank transfers are instant (arriving in <10s).
 * Without polling, users stare at "Čekáme na potvrzení platby" and
 * must manually refresh. This gives real-time feedback.
 */
export function PaymentStatusPoller({
  orderNumber,
  accessToken,
  /** Where to redirect on success (defaults to order page) */
  redirectTo,
}: {
  orderNumber: string;
  accessToken: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [isPaid, setIsPaid] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track total poll time — stop after 10 minutes to avoid infinite polling
  const pollCountRef = useRef(0);
  const MAX_POLLS = 40; // 40 × 15s = 10 minutes

  useEffect(() => {
    async function checkStatus() {
      pollCountRef.current += 1;

      // Stop polling after max attempts
      if (pollCountRef.current > MAX_POLLS) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      try {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderNumber)}/status?token=${encodeURIComponent(accessToken)}`,
        );
        if (!res.ok) return;

        const data = await res.json();
        if (data.status === "paid" || data.status === "confirmed") {
          setIsPaid(true);
          if (intervalRef.current) clearInterval(intervalRef.current);

          // Brief delay so user sees the success state before redirect
          setTimeout(() => {
            const target =
              redirectTo ??
              `/order/${encodeURIComponent(orderNumber)}?token=${encodeURIComponent(accessToken)}`;
            router.push(target);
          }, 1500);
        } else if (data.status === "cancelled") {
          // Payment was cancelled — reload to show server-rendered cancel state
          if (intervalRef.current) clearInterval(intervalRef.current);
          router.refresh();
        }
      } catch {
        // Network error — silently continue polling
      }
    }

    // First check after 5 seconds (fast for instant payments),
    // then every 15 seconds after that
    const initialTimeout = setTimeout(() => {
      checkStatus();
      intervalRef.current = setInterval(checkStatus, 15_000);
    }, 5_000);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderNumber, accessToken, redirectTo, router]);

  if (isPaid) {
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 animate-in fade-in duration-300">
        <CheckCircle2 className="size-4" />
        Platba byla přijata! Přesměrováváme...
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-3 animate-spin" />
      Automaticky ověřujeme stav platby...
    </div>
  );
}
