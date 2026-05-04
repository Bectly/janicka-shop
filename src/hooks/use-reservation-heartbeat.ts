"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "@/lib/cart-store";
import { extendReservations } from "@/lib/actions/reservation";

const HEARTBEAT_INTERVAL_MS = 60_000;
const MIN_PING_GAP_MS = 30_000;

/**
 * Pings extendReservations on a sliding interval while the cart has items
 * and the tab is visible. Backend keeps the threshold-based extend so the
 * countdown does not drak — server only refreshes when < MIN_REFRESH_MS
 * remains. When the server returns null for a product (sold, taken by
 * another visitor, or released), we mark the local row as expired (past
 * timestamp) instead of silently removing it — the cart UI surfaces the
 * "Obnovit rezervaci" soft-expire CTA from there.
 */
export function useReservationHeartbeat(enabled: boolean = true): void {
  const lastPingRef = useRef<number>(0);
  const inflightRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    let cancelled = false;

    async function ping() {
      if (cancelled || inflightRef.current) return;
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastPingRef.current < MIN_PING_GAP_MS) return;

      const items = useCartStore.getState().items;
      if (items.length === 0) return;

      inflightRef.current = true;
      lastPingRef.current = now;

      try {
        const productIds = items.map((i) => i.productId);
        const result = await extendReservations(productIds);
        if (cancelled) return;

        const updateReservation = useCartStore.getState().updateReservation;
        const expiredIso = new Date(Date.now() - 1000).toISOString();

        for (const [productId, reservedUntil] of Object.entries(result)) {
          if (reservedUntil) {
            updateReservation(productId, reservedUntil);
          } else {
            // Lost the slot — keep the row, mark it expired so soft-expire
            // CTA renders. User decides whether to retry or remove.
            updateReservation(productId, expiredIso);
          }
        }
      } catch {
        // Network/server hiccup — countdown ticks down naturally; next
        // heartbeat will retry.
      } finally {
        inflightRef.current = false;
      }
    }

    const interval = window.setInterval(ping, HEARTBEAT_INTERVAL_MS);
    const onVisibility = () => { void ping(); };
    document.addEventListener("visibilitychange", onVisibility);

    void ping();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}
