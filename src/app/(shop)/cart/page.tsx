"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2, ShoppingBag, ArrowLeft, Clock, Lock, RotateCcw, ShieldCheck, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore, type CartItem } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { releaseReservation, reserveProduct } from "@/lib/actions/reservation";
import { useReservationHeartbeat } from "@/hooks/use-reservation-heartbeat";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_PRICES, SHIPPING_METHOD_LABELS } from "@/lib/constants";
import { CartRecommendations } from "@/components/shop/cart-recommendations";
import { CartExitIntent } from "@/components/shop/cart-exit-intent";
import { FreeShippingBar } from "@/components/shop/free-shipping-bar";
import { CartEmailCapture } from "@/components/shop/cart-email-capture";
import { CartCaptureBeacon } from "@/components/shop/cart-capture-beacon";
import { ExpressCheckoutButtons } from "@/components/shop/checkout/express-checkout-buttons";
import { useSyncExternalStore, useState, useEffect, useCallback, useTransition } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const emptySubscribe = () => () => {};

export default function CartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const restoreToken = searchParams.get("restore");
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateReservation = useCartStore((s) => s.updateReservation);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [restoreState, setRestoreState] = useState<"idle" | "loading" | "success" | "error">(
    restoreToken ? "loading" : "idle"
  );

  // One-click cart restore from abandoned-cart email (cross-device hydration)
  useEffect(() => {
    if (!mounted || !restoreToken) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/cart/restore?token=${encodeURIComponent(restoreToken)}`, {
          method: "POST",
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data: { items?: Array<Partial<CartItem> & { productId: string; name: string; price: number; slug?: string; image?: string; size?: string; color?: string }> } = await res.json();
        if (cancelled) return;

        const restored: CartItem[] = (data.items ?? [])
          .filter((i) => i && typeof i.productId === "string" && typeof i.name === "string" && typeof i.price === "number")
          .map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            image: i.image ?? "",
            size: i.size ?? "",
            color: i.color ?? "",
            slug: i.slug ?? "",
            quantity: 1,
          }));

        useCartStore.setState({ items: restored });
        setRestoreState("success");
        setTimeout(() => router.push("/checkout"), 1500);
      } catch {
        if (!cancelled) setRestoreState("error");
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, restoreToken]);

  // Sliding heartbeat — pings extendReservations every 60s while tab visible.
  // The hook fires an initial ping immediately on mount, replacing the prior
  // mount-only extend call. When server returns null for an item the hook
  // marks it locally expired (past timestamp) instead of silently removing,
  // so the soft-expire CTA below can surface.
  useReservationHeartbeat(mounted);

  const handleRemove = useCallback(async (item: CartItem) => {
    removeItem(item.productId, item.size, item.color);
    await releaseReservation(item.productId);
  }, [removeItem]);

  if (!mounted) {
    // Compact SSR shell sized to match the empty-cart state (the most common
    // first-paint target: fresh visitors + Lighthouse have no persisted cart).
    // Fat item-row skeletons caused /cart CLS regression 0.020→0.423 on mobile
    // Lighthouse as hydration swapped ~670px skeleton → ~370px empty state and
    // dragged the footer up by ~300px. Keeping dimensions within the same
    // min-h-[70vh] shell absorbs residual shifts for real users with items.
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8">
        <Skeleton className="size-20 rounded-2xl" />
        <Skeleton className="mt-6 h-8 w-40" />
        <Skeleton className="mt-3 h-4 w-64 max-w-full" />
        <Skeleton className="mt-8 h-12 w-48 rounded-lg" />
      </div>
    );
  }

  if (restoreState === "loading" || restoreState === "success") {
    return (
      <div className="mx-auto min-h-[70vh] max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-sage/20 to-champagne-light ring-1 ring-inset ring-black/[0.04]">
            {restoreState === "success"
              ? <CheckCircle className="size-9 text-sage-dark" />
              : <Clock className="size-9 text-primary/60 animate-pulse" />
            }
          </div>
          <h1 className="mt-6 font-heading text-2xl font-bold">
            {restoreState === "success" ? "Košík obnoven" : "Obnovuji košík…"}
          </h1>
          <p className="mt-2 max-w-xs text-muted-foreground">
            {restoreState === "success"
              ? "Můžete pokračovat v nákupu — přesměrováváme na pokladnu."
              : "Chvíli strpení, načítáme vaše kousky."}
          </p>
        </div>
      </div>
    );
  }

  if (restoreState === "error" && items.length === 0) {
    return (
      <div className="mx-auto min-h-[70vh] max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-inset ring-destructive/20">
            <AlertCircle className="size-9 text-destructive" />
          </div>
          <h1 className="mt-6 font-heading text-2xl font-bold">
            Odkaz již nelze použít
          </h1>
          <p className="mt-2 max-w-xs text-muted-foreground">
            Tento odkaz na obnovení košíku vypršel nebo již byl použit. Vyberte si znovu z naší kolekce.
          </p>
          <Button size="lg" className="mt-8" render={<Link href="/products" />}>
            Prohlédnout kolekci
          </Button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto min-h-[70vh] max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
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
    <div className="mx-auto min-h-[70vh] max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
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
            onReservationUpdate={updateReservation}
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

        {/* Inline trust signals — 40-60% better than footer (C1496) */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t pt-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5 text-sage-dark" />
            Zabezpečená platba
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RotateCcw className="size-3.5 text-sage-dark" />
            14 dní na vrácení
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-sage-dark" />
            Ověřená kvalita
          </span>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Pokračovat v nákupu
        </Link>
      </div>

      {/* Cross-sell recommendations from same categories */}
      <CartRecommendations />

      {/* Exit intent popup — unique items urgency (desktop only, once per session) */}
      <CartExitIntent />

      {/* Abandoned-cart beacon — fires sendBeacon on tab hide/unload when consent+email known */}
      <CartCaptureBeacon pageUrl="/cart" />
    </div>
  );
}

function countdownSeconds(countdown: string): number {
  const [m, s] = countdown.split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
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
  onReservationUpdate,
}: {
  item: CartItem;
  onRemove: () => void;
  onReservationUpdate: (productId: string, reservedUntil: string | null) => void;
}) {
  const countdown = useCountdown(item.reservedUntil);
  const isExpired = countdown === "0:00";
  const isUrgent = countdown !== "" && !isExpired && countdownSeconds(countdown) < 120;
  const [isRemoving, startTransition] = useTransition();
  const [retryStatus, setRetryStatus] = useState<
    "idle" | "retrying" | "reserved_by_other" | "sold"
  >("idle");

  const handleRetry = useCallback(async () => {
    setRetryStatus("retrying");
    try {
      const result = await reserveProduct(item.productId);
      if (result.success && result.reservedUntil) {
        onReservationUpdate(item.productId, result.reservedUntil);
        setRetryStatus("idle");
        return;
      }
      // Distinguish sold/inactive vs reserved-by-other from the error message
      // returned by reserveProduct. On "Produkt nebyl nalezen" or unavailable
      // we treat as sold (auto-remove). Otherwise reserved by another visitor.
      const msg = result.error ?? "";
      if (/nalezen|nedostupn/i.test(msg) && !/rezervov/i.test(msg)) {
        setRetryStatus("sold");
        // Auto-remove after a short delay so user sees the message.
        window.setTimeout(() => onRemove(), 2500);
      } else {
        setRetryStatus("reserved_by_other");
      }
    } catch {
      setRetryStatus("reserved_by_other");
    }
  }, [item.productId, onRemove, onReservationUpdate]);

  return (
    <div className={`flex flex-col gap-2 py-4 ${isExpired ? "opacity-90" : ""}`}>
      <div className={`flex gap-4 ${isExpired && retryStatus !== "idle" ? "opacity-60" : ""}`}>
        {/* Product image */}
        <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
          {item.image ? (
            <Image
              src={item.image}
              alt={item.name}
              width={80}
              height={80}
              className="size-full object-cover"
              unoptimized
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
                className="text-sm font-medium transition-colors duration-150 hover:text-primary"
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
                <span className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium transition-colors ${
                  isUrgent
                    ? "animate-pulse border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-champagne-dark/30 bg-champagne-light text-charcoal-light"
                }`}>
                  <Clock className="size-3" />
                  {countdown}
                </span>
              )}
              {isExpired && (
                <span className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                  <AlertCircle className="size-3" />
                  Rezervace vypršela
                </span>
              )}
            </div>
            <button
              onClick={() => startTransition(() => { onRemove(); })}
              disabled={isRemoving}
              className="flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Odebrat z košíku"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Soft-expire CTA — countdown hit 0:00, give user a one-click retry
          before forcing manual remove. Three outcomes are surfaced inline. */}
      {isExpired && retryStatus === "idle" && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-champagne-dark/30 bg-champagne-light/60 px-3 py-2 text-xs text-charcoal">
          <span className="flex-1">
            Rezervace vypršela. Zkuste ji obnovit, ať vám kousek neuteče.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={handleRetry}
          >
            <RotateCcw className="size-3" />
            Obnovit rezervaci
          </Button>
        </div>
      )}
      {isExpired && retryStatus === "retrying" && (
        <div className="flex items-center gap-2 rounded-lg border border-champagne-dark/30 bg-champagne-light/60 px-3 py-2 text-xs text-charcoal">
          <Clock className="size-3.5 shrink-0 animate-pulse" />
          <span>Obnovuji rezervaci…</span>
        </div>
      )}
      {isExpired && retryStatus === "reserved_by_other" && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span className="flex-1">
            Někdo už si tento kus rezervoval první.
          </span>
          <Link
            href={`/products?ref=${encodeURIComponent(item.productId)}`}
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Zobrazit podobné
          </Link>
          <button
            type="button"
            onClick={() => startTransition(() => { onRemove(); })}
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Odebrat
          </button>
        </div>
      )}
      {isExpired && retryStatus === "sold" && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span>Tento kus byl právě prodán. Odebírám z košíku…</span>
        </div>
      )}
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
          <span className={isFree ? "flex items-center gap-1 font-medium text-sage-dark" : "text-foreground"}>
            {isFree && <CheckCircle className="size-3 shrink-0" />}
            {isFree ? "Zdarma" : formatPrice(price)}
          </span>
        </div>
      ))}
    </div>
  );
}

