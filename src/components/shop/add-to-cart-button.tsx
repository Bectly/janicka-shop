"use client";

import { useState, useTransition } from "react";
import { ShoppingBag, Check, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { reserveProduct } from "@/lib/actions/reservation";
import { trackAddToCart } from "@/lib/analytics";
import { SizeGuide } from "@/components/shop/size-guide";
import { MobileStickyAtc } from "@/components/shop/mobile-sticky-atc";
import { getImageUrls } from "@/lib/images";

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
    reservedByOther?: boolean;
  };
}

export function AddToCartButton({ product }: AddToCartProps) {
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] ?? "");
  const [selectedColor, setSelectedColor] = useState(product.colors[0] ?? "");
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isInCart = items.some((i) => i.productId === product.id);

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
      setTimeout(() => setAdded(false), 2000);
    });
  }

  return (
    <>
      <div id="atc-sentinel" className="mt-6 space-y-4">
        {/* Size selector */}
        {product.sizes.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium" id="size-label">Velikost</p>
              <SizeGuide />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="size-label">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  aria-pressed={selectedSize === size}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedSize === size
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
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
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    selectedColor === color
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30"
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
          size="lg"
          className="w-full"
          onClick={handleAdd}
          disabled={product.stock === 0 || isPending || isInCart || product.reservedByOther}
        >
          {isPending ? (
            <>
              <Loader2 data-icon="inline-start" className="size-4 animate-spin" />
              Rezervuji...
            </>
          ) : added ? (
            <>
              <Check data-icon="inline-start" className="size-4" />
              Přidáno do košíku
            </>
          ) : isInCart ? (
            <>
              <Check data-icon="inline-start" className="size-4" />
              Již v košíku
            </>
          ) : product.reservedByOther ? (
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
        isReservedByOther={!!product.reservedByOther}
        stock={product.stock}
        isPending={isPending}
        onAdd={handleAdd}
      />
    </>
  );
}
