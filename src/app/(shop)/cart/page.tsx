"use client";

import Link from "next/link";
import Image from "next/image";
import { Trash2, ShoppingBag, ArrowLeft, Clock, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore, type CartItem } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { releaseReservation, extendReservations } from "@/lib/actions/reservation";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_PRICES } from "@/lib/constants";
import { CartRecommendations } from "@/components/shop/cart-recommendations";
import { useSyncExternalStore, useState, useEffect, useCallback, useTransition } from "react";

const emptySubscribe = () => () => {};

export default function CartPage() {
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
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <ShoppingBag className="mx-auto size-12 text-muted-foreground/40" />
        <h1 className="mt-4 font-heading text-2xl font-bold">
          Košík je prázdný
        </h1>
        <p className="mt-2 text-muted-foreground">
          Přidejte si něco hezkého z naší kolekce.
        </p>
        <Button className="mt-6" render={<Link href="/products" />}>
          Prohlédnout produkty
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold">Košík</h1>

      {/* Reservation info banner */}
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
      <div className="mt-8 rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Celkem</span>
          <span>{formatPrice(totalPrice())}</span>
        </div>

        {/* Free shipping progress bar */}
        <FreeShippingBar total={totalPrice()} />

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
    </div>
  );
}

/** Countdown timer hook — returns "MM:SS" string, empty when expired */
function useCountdown(expiresAt: string | undefined): string {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
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
              <span className="flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">
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
            className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
            aria-label="Odebrat z košíku"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FreeShippingBar({ total }: { total: number }) {
  const isFree = total >= FREE_SHIPPING_THRESHOLD;
  const remaining = FREE_SHIPPING_THRESHOLD - total;
  const progress = Math.min((total / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const minShipping = Math.min(...Object.values(SHIPPING_PRICES));

  return (
    <div className="mt-3">
      {isFree ? (
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
          <Truck className="size-4" />
          <span>Doprava zdarma!</span>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Ještě <span className="font-semibold text-foreground">{formatPrice(remaining)}</span> do dopravy zdarma
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Doprava od {formatPrice(minShipping)}
          </p>
        </>
      )}
    </div>
  );
}
