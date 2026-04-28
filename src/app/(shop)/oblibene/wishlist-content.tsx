"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Share2, Check } from "lucide-react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { Button } from "@/components/ui/button";
import {
  WishlistCard,
  WishlistCardSkeleton,
} from "@/components/shop/wishlist-card";
import { WishlistEmpty } from "@/components/shop/wishlist-empty";
import {
  getWishlistProducts,
  subscribeWishlistNotifications,
  type WishlistProduct,
} from "./actions";

const emptySubscribe = () => () => {};

export function WishlistContent() {
  const wishlistIds = useWishlistStore((s) => s.items);
  const toggle = useWishlistStore((s) => s.toggle);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareCopied, setShareCopied] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyState, setNotifyState] = useState<
    "idle" | "submitting" | "done" | "error"
  >("idle");

  async function handleNotifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (notifyState === "submitting") return;
    const email = notifyEmail.trim();
    if (!email) return;
    setNotifyState("submitting");
    try {
      const available = products.filter((p) => !p.sold).map((p) => p.id);
      if (available.length === 0) {
        setNotifyState("done");
        return;
      }
      const res = await subscribeWishlistNotifications({
        email,
        productIds: available,
      });
      setNotifyState(res.ok ? "done" : "error");
    } catch {
      setNotifyState("error");
    }
  }

  async function handleShare() {
    const ids = wishlistIds.slice(0, 50);
    const origin = window.location.origin;
    const shareUrl = `${origin}/oblibene/sdilej?ids=${ids.join(",")}`;
    const shareData = {
      title: "Seznam přání z Janička Shop",
      text: "Podívej se na moje oblíbené kousky!",
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    } catch {
      // Clipboard not available
    }
  }

  useEffect(() => {
    if (!mounted) return;

    if (wishlistIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when wishlist clears
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    getWishlistProducts(wishlistIds).then((data) => {
      const sorted = data.sort((a, b) => {
        if (a.sold !== b.sold) return a.sold ? 1 : -1;
        return 0;
      });
      setProducts(sorted);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [wishlistIds, mounted]);

  // Pre-hydration / initial render: skeleton placeholder sized to expected count
  // to prevent visible layout flicker — no progressive load text.
  if (!mounted || loading) {
    const count = mounted && wishlistIds.length > 0 ? Math.min(wishlistIds.length, 8) : 4;
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4"
      >
        {Array.from({ length: count }).map((_, i) => (
          <WishlistCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (wishlistIds.length === 0) {
    return <WishlistEmpty />;
  }

  const hasAvailableItems = products.some((p) => !p.sold);

  return (
    <>
      {hasAvailableItems && (
        <div className="mb-6 rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
          {notifyState === "done" ? (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Check className="size-4 text-green-600" />
              Hotovo — ozveme se ti, jakmile se některý z tvých kousků prodá.
            </div>
          ) : (
            <form
              onSubmit={handleNotifySubmit}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Chceš vědět, až některý kousek zmizí?
                </p>
                <p className="text-xs text-muted-foreground">
                  Pošleme ti email s podobnými kousky — každý je unikát.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="tvuj@email.cz"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm transition-colors duration-200 focus:border-primary focus:outline-none sm:w-52"
                  aria-label="Email pro notifikace"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="shrink-0"
                  disabled={notifyState === "submitting"}
                >
                  {notifyState === "submitting" ? "Odesílám…" : "Chci vědět"}
                </Button>
              </div>
            </form>
          )}
          {notifyState === "error" && (
            <p className="mt-2 text-xs text-destructive">
              Něco se pokazilo. Zkus to prosím znovu.
            </p>
          )}
        </div>
      )}
      <div className="mb-6 flex justify-end">
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-all duration-200 hover:bg-muted active:scale-95"
        >
          {shareCopied ? (
            <>
              <Check className="size-4 text-green-600" />
              Odkaz zkopírován!
            </>
          ) : (
            <>
              <Share2 className="size-4" />
              Sdílet přání
            </>
          )}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <WishlistCard
            key={product.id}
            product={product}
            onRemove={(id) => toggle(id)}
          />
        ))}
      </div>
    </>
  );
}
