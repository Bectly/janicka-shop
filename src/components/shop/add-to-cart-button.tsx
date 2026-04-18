"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { ShoppingBag, Check, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { reserveProduct } from "@/lib/actions/reservation";
import { trackAddToCart } from "@/lib/analytics";
import { SizeGuide } from "@/components/shop/size-guide";
import { MobileStickyAtc } from "@/components/shop/mobile-sticky-atc";
import { getImageUrls } from "@/lib/images";
import { flyToCart } from "@/lib/fly-to-cart";
import confetti from "canvas-confetti";

interface AddToCartProps {
  product: {
    id: string;
    name: string;
    price: number;
    slug: string;
    images: string;
    sizes: string[];
    colors: string[];
    stock: number;
    reservedUntil?: string | null; // ISO date string — computed client-side to avoid server cookies()
  };
  hideSize?: boolean;
}

export function AddToCartButton({ product, hideSize = false }: AddToCartProps) {
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  // Second-hand pieces are unique (stock = 1). The `sizes` array holds the SAME
  // size expressed in different systems (e.g. ["M","38","10"] = EU/UK notation),
  // not selectable variants — so we always use the first entry as the primary.
  const selectedSize = product.sizes[0] ?? "";
  const [selectedColor, setSelectedColor] = useState(product.colors[0] ?? "");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isInCart = items.some((i) => i.productId === product.id);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fireConfetti = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { x, y },
      colors: ["#f43f5e", "#fb7185", "#fda4af", "#fff1f2"],
      disableForReducedMotion: true,
    });
  }, []);

  // Compute reservation status client-side: if there's an active reservation
  // and this user doesn't have the item in cart, it's reserved by someone else.
  const isReservedByOther =
    !!product.reservedUntil &&
    new Date(product.reservedUntil) > new Date() &&
    !isInCart;

  const imageList = getImageUrls(product.images);

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await reserveProduct(product.id);
      if (!result.success) {
        setError(result.error ?? "Rezervace se nezdařila");
        return;
      }
      addItem({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: imageList[0] ?? "",
        size: selectedSize,
        color: selectedColor,
        quantity: 1,
        slug: product.slug,
        reservedUntil: result.reservedUntil,
      });
      trackAddToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        variant: [selectedSize, selectedColor].filter(Boolean).join(" / ") || undefined,
      });
      setAdded(true);
      if (buttonRef.current) {
        flyToCart(imageList[0] ?? "", buttonRef.current);
      }
      fireConfetti();
      setTimeout(() => setAdded(false), 2000);
    });
  }

  return (
    <>
      <div id="atc-sentinel" className="mt-6 space-y-4">
        {/* Size — static label (second-hand = 1 kus, sizes array = equivalents). Hidden for accessories. */}
        {!hideSize && product.sizes.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Velikost kusu</p>
              <SizeGuide />
            </div>
            <span className="inline-flex items-center rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground">
              {product.sizes.join(" · ")}
            </span>
            {product.sizes.length > 1 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Tento kus sedí na velikosti {product.sizes.join(" / ")} (ekvivalenty pro srovnání)
              </p>
            )}
          </div>
        )}

        {/* Color selector */}
        {product.colors.length > 1 && (
          <div>
            <p className="mb-2 text-sm font-medium" id="color-label">Barva</p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="color-label">
              {product.colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  aria-pressed={selectedColor === color}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-90 ${
                    selectedColor === color
                      ? "border-primary bg-primary/10 text-primary animate-ring-expand"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:bg-muted/30"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        )}

        {/* Screen reader announcement for cart actions */}
        <div role="status" aria-live="polite" className="sr-only">
          {added ? "Produkt přidán do košíku" : ""}
        </div>

        {/* Add to cart button */}
        <Button
          ref={buttonRef}
          size="lg"
          className="w-full"
          onClick={handleAdd}
          disabled={product.stock === 0 || isPending || isInCart || isReservedByOther}
        >
          {isPending ? (
            <>
              <Loader2 data-icon="inline-start" className="size-4 animate-spin" />
              Rezervuji...
            </>
          ) : added ? (
            <>
              <Check data-icon="inline-start" className="size-4 animate-scale-in" />
              Přidáno do košíku
            </>
          ) : isInCart ? (
            <>
              <Check data-icon="inline-start" className="size-4" />
              Již v košíku
            </>
          ) : isReservedByOther ? (
            <>
              <Clock data-icon="inline-start" className="size-4" />
              Rezervováno
            </>
          ) : product.stock === 0 ? (
            "Nedostupné"
          ) : (
            <>
              <ShoppingBag data-icon="inline-start" className="size-4" />
              Přidat do košíku
            </>
          )}
        </Button>
      </div>

      {/* Mobile sticky add-to-cart bar — appears when main button scrolls away */}
      <MobileStickyAtc
        productName={product.name}
        price={product.price}
        isInCart={isInCart}
        isReservedByOther={!!isReservedByOther}
        stock={product.stock}
        isPending={isPending}
        onAdd={handleAdd}
      />
    </>
  );
}
