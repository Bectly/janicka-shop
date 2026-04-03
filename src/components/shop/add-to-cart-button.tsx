"use client";

import { useState } from "react";
import { ShoppingBag, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";

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
  };
}

export function AddToCartButton({ product }: AddToCartProps) {
  const addItem = useCartStore((s) => s.addItem);
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] ?? "");
  const [selectedColor, setSelectedColor] = useState(product.colors[0] ?? "");
  const [added, setAdded] = useState(false);

  let imageList: string[] = [];
  try { imageList = JSON.parse(product.images); } catch { /* corrupted data fallback */ }

  function handleAdd() {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: imageList[0] ?? "",
      size: selectedSize,
      color: selectedColor,
      quantity: 1,
      slug: product.slug,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Size selector */}
      {product.sizes.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium">Velikost</p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
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
          <p className="mb-2 text-sm font-medium">Barva</p>
          <div className="flex flex-wrap gap-2">
            {product.colors.map((color) => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
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

      {/* Add to cart button */}
      <Button
        size="lg"
        className="w-full"
        onClick={handleAdd}
        disabled={product.stock === 0}
      >
        {added ? (
          <>
            <Check data-icon="inline-start" className="size-4" />
            Přidáno do košíku
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
  );
}
