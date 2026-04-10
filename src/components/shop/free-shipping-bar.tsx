"use client";

import { Truck } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_PRICES } from "@/lib/constants";
import { useCartStore } from "@/lib/cart-store";

/**
 * Free shipping progress bar.
 *
 * When `productPrice` is provided (PDP context), the bar shows progress
 * assuming the product is added to the cart — "S tímto kouskem ještě X Kč
 * do dopravy zdarma".
 *
 * When used without `productPrice` (cart context), pass `total` directly.
 */
export function FreeShippingBar({
  total: externalTotal,
  productPrice,
  hideMinLabel = false,
}: {
  total?: number;
  productPrice?: number;
  /** Set true when a separate shipping preview already shows the minimum price */
  hideMinLabel?: boolean;
}) {
  const cartTotal = useCartStore((s) => s.totalPrice());
  const total = externalTotal ?? (cartTotal + (productPrice ?? 0));

  const isFree = total >= FREE_SHIPPING_THRESHOLD;
  const remaining = FREE_SHIPPING_THRESHOLD - total;
  const progress = Math.min((total / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const minShipping = Math.min(...Object.values(SHIPPING_PRICES));

  return (
    <div className="mt-3">
      {isFree ? (
        <div className="flex items-center gap-2 text-sm font-medium text-sage-dark">
          <Truck className="size-4" />
          <span>Doprava zdarma!</span>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {productPrice != null ? "S tímto kouskem ještě " : "Ještě "}
            <span className="font-semibold text-foreground">
              {formatPrice(remaining)}
            </span>{" "}
            do dopravy zdarma
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {!hideMinLabel && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Doprava od {formatPrice(minShipping)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
