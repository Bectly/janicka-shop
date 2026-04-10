"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Trash2, ShoppingBag, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore, type CartItem } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { releaseReservation, extendReservations } from "@/lib/actions/reservation";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_PRICES, SHIPPING_METHOD_LABELS } from "@/lib/constants";
import { CartRecommendations } from "@/components/shop/cart-recommendations";
import { CartExitIntent } from "@/components/shop/cart-exit-intent";
import { FreeShippingBar } from "@/components/shop/free-shipping-bar";
import { CartEmailCapture } from "@/components/shop/cart-email-capture";
import { ExpressCheckoutButtons } from "@/components/shop/checkout/express-checkout-buttons";
import { useSyncExternalStore, useState, useEffect, useCallback, useTransition } from "react";

const emptySubscribe = () => () => {};

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateReservation = useCartStore((s) => s.updateReservation);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Extend reservations on mount
  useEffect(() => {
    if (!mounted || items.length === 0) return;
    const productIds = items.map((i) => i.productId);
    extendReservations(productIds).then((result) => {
      for (const [productId, reservedUntil] of Object.entries(result)) {
        // updateReservation handles both cases:
        // truthy → updates expiry, null → removes item by productId
        updateReservation(productId, reservedUntil);
      }
    }).catch(() => {
      // Non-critical — reservations continue with existing expiry
    });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const handleRemove = useCallback(async (item: CartItem) => {
    removeItem(item.productId, item.size, item.color);
    await releaseReservation(item.productId);
  }, [removeItem]);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-bold">Košík</h1>
        <p className="mt-4 text-muted-foreground">Načítání...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blush to-champagne-light ring-1 ring-inset ring-black/[0.04]">
            <ShoppingBag className="size-9 text-primary/60" />
          </div>
          <h1 className="mt-6 font-heading text-2xl font-bold">
            Košík je prázdný
          </h1>
          <p className="mt-2 max-w-xs text-muted-foreground">
            Přidejte si něco hezkého z naší kolekce jedinečných kousků.
          </p>
          <Button size="lg" className="mt-8" render={<Link href="/products" />}>
            Prohlédnout kolekci
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-end gap-3">
        <h1 className="font-heading text-3xl font-bold">Košík</h1>
        <span className="mb-1 inline-flex items-center rounded-full border border-primary/20 bg-primary/[0.06] px-2.5 py-0.5 text-xs font-semibold text-primary">
          {items.length} {items.length === 1 ? "kousek" : items.length < 5 ? "kousky" : "kusů"}
        </span>
      </div>

      {/* Reservation info banner */}
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-champagne-dark/40 bg-champagne-light px-4 py-3 text-sm text-charcoal">
        <Clock className="size-4 shrink-0" />
        <span>
          Produkty jsou pro vás rezervovány na 15 minut. Po vypršení se vrátí do nabídky.
        </span>
      </div>

      <div className="mt-6 divide-y">
        {items.map((item) => (
          <CartItemRow
            key={`${item.productId}-${item.size}-${item.color}`}
            item={item}
            onRemove={() => handleRemove(item)}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 rounded-xl border border-brand/10 bg-gradient-to-br from-brand/[0.03] via-card to-champagne-light/20 p-6">
        <div className="flex items-center justify-between text-base font-semibold">
          <span>Mezisoučet</span>
          <span>{formatPrice(totalPrice())}</span>
        </div>

        {/* Shipping cost preview — 48% abandon due to unexpected costs (Baymard) */}
        <ShippingPreview total={totalPrice()} />

        {/* Free shipping progress bar */}
        <FreeShippingBar total={totalPrice()} hideMinLabel />

        {/* Email capture for abandoned cart recovery — captures email before checkout */}
        <div className="mt-4">
          <CartEmailCapture />
        </div>

        {/* Express checkout (Apple Pay / Google Pay) — C1496: multiple touchpoints */}
        <div className="mt-4">
          <ExpressCheckoutButtons onSelect={() => router.push("/checkout")} />
        </div>

        <Button size="lg" className="mt-4 w-full" render={<Link href="/checkout" />}>
          Pokračovat k objednávce
        </Button>
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Pokračovat v nákupu
        </Link>
      </div>

      {/* Cross-sell recommendations from same categories */}
      <CartRecommendations />

      {/* Exit intent popup — unique items urgency (desktop only, once per session) */}
      <CartExitIntent />
    </div>
  );
}

/** Countdown timer hook — returns "MM:SS" string, empty when expired */
function useCountdown(expiresAt: string | undefined): string {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears countdown when expiresAt changes to undefined
    if (!expiresAt) { setRemaining(""); return; }

    function tick() {
      const diff = new Date(expiresAt!).getTime() - Date.now();
      if (diff <= 0) { setRemaining("0:00"); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return remaining;
}

function CartItemRow({
  item,
  onRemove,
}: {
  item: CartItem;
  onRemove: () => void;
}) {
  const countdown = useCountdown(item.reservedUntil);
  const isExpired = countdown === "0:00";
  const [isRemoving, startTransition] = useTransition();

  return (
    <div className={`flex gap-4 py-4 ${isExpired ? "opacity-50" : ""}`}>
      {/* Product image */}
      <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            width={80}
            height={80}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-lg text-muted-foreground/30">
            {item.name.charAt(0)}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex justify-between">
          <div>
            <Link
              href={`/products/${item.slug}`}
              className="text-sm font-medium hover:text-primary"
            >
              {item.name}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.size && `${item.size}`}
              {item.size && item.color && " · "}
              {item.color && `${item.color}`}
            </p>
          </div>
          <span className="text-sm font-semibold">
            {formatPrice(item.price)}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Unikátní kus</span>
            {countdown && !isExpired && (
              <span className="flex items-center gap-1 rounded-md bg-champagne-light px-1.5 py-0.5 text-xs font-medium text-charcoal-light">
                <Clock className="size-3" />
                {countdown}
              </span>
            )}
            {isExpired && (
              <span className="text-xs font-medium text-destructive">
                Rezervace vypršela
              </span>
            )}
          </div>
          <button
            onClick={() => startTransition(() => { onRemove(); })}
            disabled={isRemoving}
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
            aria-label="Odebrat z košíku"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ShippingPreview({ total }: { total: number }) {
  const isFree = total >= FREE_SHIPPING_THRESHOLD;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Doprava:</p>
      {Object.entries(SHIPPING_PRICES).map(([method, price]) => (
        <div key={method} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {SHIPPING_METHOD_LABELS[method] ?? method}
          </span>
          <span className={isFree ? "font-medium text-sage-dark" : "text-foreground"}>
            {isFree ? "Zdarma" : formatPrice(price)}
          </span>
        </div>
      ))}
    </div>
  );
}

