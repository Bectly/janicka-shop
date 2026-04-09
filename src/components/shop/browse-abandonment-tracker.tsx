"use client";

import { useEffect, useRef } from "react";
import { trackBrowseView } from "@/app/(shop)/products/[slug]/browse-actions";
import { useCartStore } from "@/lib/cart-store";

/** localStorage key for known customer email (set during checkout or newsletter signup). */
export const CUSTOMER_EMAIL_KEY = "janicka-customer-email";

interface Props {
  productId: string;
  productSlug: string;
  productName: string;
  productImage: string | undefined;
  productPrice: number;
  productBrand: string | null;
  productSize: string | null;
}

/**
 * Invisible component mounted on the PDP.
 * Tracks browse abandonment when:
 *   1. Customer email is known (localStorage from prior checkout/newsletter)
 *   2. User dwells on PDP for ≥ 5 seconds
 *   3. Product is NOT already in the user's cart
 *
 * Fires once per page load — no spam.
 */
export function BrowseAbandonmentTracker({
  productId,
  productSlug,
  productName,
  productImage,
  productPrice,
  productBrand,
  productSize,
}: Props) {
  const firedRef = useRef(false);
  const items = useCartStore((s) => s.items);

  useEffect(() => {
    if (firedRef.current) return;

    // Skip if product is already in cart
    if (items.some((i) => i.productId === productId)) return;

    // Check for known email
    let email: string | null = null;
    try {
      email = localStorage.getItem(CUSTOMER_EMAIL_KEY);
    } catch {
      return; // SSR or localStorage blocked
    }
    if (!email) return;

    // Dwell time gate: 5 seconds minimum
    const timer = setTimeout(() => {
      if (firedRef.current) return;
      firedRef.current = true;

      trackBrowseView({
        email: email!,
        productId,
        productSlug,
        productName,
        productImage,
        productPrice,
        productBrand: productBrand ?? undefined,
        productSize: productSize ?? undefined,
      }).catch(() => {});
    }, 5000);

    return () => clearTimeout(timer);
  }, [productId, items]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
