"use client";

import { Heart, Check } from "lucide-react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { useSyncExternalStore, useCallback, useState } from "react";
import { subscribeSingleWishlistNotification } from "@/app/(shop)/oblibene/actions";

const emptySubscribe = () => () => {};

interface WishlistButtonProps {
  productId: string;
  /** "card" = small overlay on product card, "detail" = larger standalone button */
  variant?: "card" | "detail";
  className?: string;
}

type NotifyState =
  | { kind: "hidden" }
  | { kind: "prompt" }
  | { kind: "submitting" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function WishlistButton({
  productId,
  variant = "card",
  className = "",
}: WishlistButtonProps) {
  const toggle = useWishlistStore((s) => s.toggle);
  const has = useWishlistStore((s) => s.has);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [animating, setAnimating] = useState(false);
  const [notify, setNotify] = useState<NotifyState>({ kind: "hidden" });
  const [email, setEmail] = useState("");

  const isWishlisted = mounted ? has(productId) : false;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const willBeWishlisted = !isWishlisted;
      toggle(productId);
      setAnimating(true);
      setTimeout(() => setAnimating(false), 500);

      // Only attempt server-side subscribe on ADD for the PDP detail variant.
      if (variant !== "detail" || !willBeWishlisted) return;

      // Optimistically try auto-subscribe — server uses session email for
      // signed-in customers. If unauthenticated, prompt for email.
      subscribeSingleWishlistNotification({ productId }).then((res) => {
        if (res.ok) {
          setNotify({ kind: "done" });
          return;
        }
        if (res.reason === "auth_required") {
          setNotify({ kind: "prompt" });
        }
      }).catch(() => {
        // Silent — wishlist add itself succeeded client-side.
      });
    },
    [toggle, productId, isWishlisted, variant],
  );

  const handleNotifySubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) return;
      setNotify({ kind: "submitting" });
      try {
        const res = await subscribeSingleWishlistNotification({
          productId,
          email: trimmed,
        });
        if (res.ok) {
          setNotify({ kind: "done" });
        } else if (res.reason === "rate_limited") {
          setNotify({
            kind: "error",
            message: "Moc pokusů. Zkus to za chvilku znovu.",
          });
        } else {
          setNotify({
            kind: "error",
            message: "Něco se pokazilo. Zkus to prosím znovu.",
          });
        }
      } catch {
        setNotify({
          kind: "error",
          message: "Něco se pokazilo. Zkus to prosím znovu.",
        });
      }
    },
    [email, productId],
  );

  if (variant === "detail") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={handleClick}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95 ${
            isWishlisted
              ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          aria-label={isWishlisted ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
        >
          <Heart
            className={`size-4 transition-colors duration-200 ${animating ? "animate-heart-burst" : ""} ${
              isWishlisted ? "fill-red-500 text-red-500" : ""
            }`}
          />
          {isWishlisted ? "V oblíbených" : "Oblíbit"}
        </button>

        {notify.kind === "prompt" && (
          <form
            onSubmit={handleNotifySubmit}
            className="mt-3 rounded-lg border border-border bg-muted/40 p-3"
          >
            <p className="mb-1 text-sm font-medium text-foreground">
              Dej vědět, až se prodá
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              Pošleme ti email s podobnými kousky — každý je unikát.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                required
                placeholder="tvuj@email.cz"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                autoComplete="email"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                aria-label="Email pro notifikaci"
              />
              <button
                type="submit"
                className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                Odeslat
              </button>
            </div>
          </form>
        )}

        {notify.kind === "submitting" && (
          <p className="mt-2 text-xs text-muted-foreground">Odesílám…</p>
        )}

        {notify.kind === "done" && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground">
            <Check className="size-3.5 text-green-600" />
            Hotovo — ozveme se, až se tenhle kousek prodá.
          </p>
        )}

        {notify.kind === "error" && (
          <p className="mt-2 text-xs text-destructive">{notify.message}</p>
        )}
      </div>
    );
  }

  // Card variant — small overlay button, no PDP-style email capture.
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex size-11 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-all duration-150 hover:bg-background hover:shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`}
      aria-label={isWishlisted ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
    >
      <Heart
        className={`size-4 transition-colors ${animating ? "animate-heart-burst" : ""} ${
          isWishlisted ? "fill-red-500 text-red-500" : "text-foreground/70"
        }`}
      />
    </button>
  );
}
