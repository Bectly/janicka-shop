"use client";

import { useEffect } from "react";
import { useCartStore } from "@/lib/cart-store";
import {
  CUSTOMER_EMAIL_KEY,
  MARKETING_CONSENT_KEY,
} from "@/components/shop/browse-abandonment-tracker";

interface Props {
  /** Used as `pageUrl` in the capture payload — distinguishes /cart vs /checkout pendings. */
  pageUrl: string;
  /** Listen to `beforeunload` in addition to `visibilitychange` + `pagehide` (checkout only). */
  beforeUnload?: boolean;
}

/**
 * Fires `navigator.sendBeacon` → POST /api/cart/capture when the tab becomes
 * hidden (visibilitychange) or the page unloads (pagehide / beforeunload).
 *
 * GDPR: only fires when the customer has EXPLICITLY opted in via
 * MARKETING_CONSENT_KEY = "true". Email comes from CUSTOMER_EMAIL_KEY,
 * populated by CartEmailCapture or the checkout email blur.
 *
 * Backend dedups by email (pending row update), so multi-fire is safe.
 */
export function CartCaptureBeacon({ pageUrl, beforeUnload = false }: Props) {
  useEffect(() => {
    function send() {
      if (typeof navigator === "undefined" || !("sendBeacon" in navigator)) return;

      let email: string | null = null;
      let consent = false;
      try {
        email = localStorage.getItem(CUSTOMER_EMAIL_KEY);
        consent = localStorage.getItem(MARKETING_CONSENT_KEY) === "true";
      } catch {
        return;
      }
      if (!email || !consent) return;

      const state = useCartStore.getState();
      const items = state.items;
      if (items.length === 0) return;

      const payload = {
        email,
        cartItems: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          size: i.size || undefined,
          color: i.color || undefined,
          image: i.image || undefined,
          slug: i.slug || undefined,
        })),
        cartTotal: state.totalPrice(),
        marketingConsent: true,
        pageUrl,
      };

      try {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/cart/capture", blob);
      } catch {
        // best-effort — beacon failures must never disrupt navigation
      }
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") send();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);
    if (beforeUnload) window.addEventListener("beforeunload", send);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
      if (beforeUnload) window.removeEventListener("beforeunload", send);
    };
  }, [pageUrl, beforeUnload]);

  return null;
}
