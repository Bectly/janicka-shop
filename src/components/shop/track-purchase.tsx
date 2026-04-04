"use client";

import { useEffect, useRef } from "react";
import { trackPurchase, type AnalyticsItem } from "@/lib/analytics";

interface TrackPurchaseProps {
  transactionId: string;
  items: AnalyticsItem[];
  total: number;
}

/** Fires purchase event once on mount. Renders nothing. */
export function TrackPurchase({ transactionId, items, total }: TrackPurchaseProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackPurchase(transactionId, items, total);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- fire once on mount

  return null;
}
