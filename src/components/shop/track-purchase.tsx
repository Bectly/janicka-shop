"use client";

import { useEffect, useRef } from "react";
import { trackPurchase, type AnalyticsItem } from "@/lib/analytics";

interface TrackPurchaseProps {
  transactionId: string;
  items: AnalyticsItem[];
  total: number;
}

/** Fires purchase event once per order. Renders nothing.
 *
 * Uses sessionStorage to survive remounts — when the PaymentStatusPoller
 * detects payment success and calls router.push() to the same URL, Next.js
 * remounts client components, resetting useRef values. Without sessionStorage
 * the purchase event would fire twice for online payments (card/bank transfer).
 */
export function TrackPurchase({ transactionId, items, total }: TrackPurchaseProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const key = `purchase-tracked-${transactionId}`;
    if (sessionStorage.getItem(key)) {
      fired.current = true;
      return;
    }
    fired.current = true;
    sessionStorage.setItem(key, "1");
    trackPurchase(transactionId, items, total);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- fire once per order

  return null;
}
