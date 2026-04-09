"use client";

import { useEffect, useState } from "react";
import { useCartStore } from "@/lib/cart-store";
import { getCartRecommendations } from "@/app/(shop)/actions";
import { ProductCard } from "./product-card";

type Recommendation = {
  id: string;
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  images: string;
  categoryName: string;
  brand: string | null;
  condition: string;
  sizes: string;
  colors: string;
  stock: number;
};

export function CartRecommendations() {
  const items = useCartStore((s) => s.items);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    if (items.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to empty when cart clears (items → [])
      setRecommendations([]);
      return;
    }

    const productIds = items.map((i) => i.productId);
    getCartRecommendations(productIds).then(setRecommendations).catch(() => {
      // Non-critical — cross-sell section simply won't render
    });
  }, [items]);

  if (recommendations.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-heading text-xl font-bold text-foreground">
        Mohlo by se vám líbit
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
        {recommendations.map((p) => (
          <ProductCard
            key={p.id}
            id={p.id}
            name={p.name}
            slug={p.slug}
            price={p.price}
            compareAt={p.compareAt}
            images={p.images}
            categoryName={p.categoryName}
            brand={p.brand}
            condition={p.condition}
            sizes={p.sizes}
            colors={p.colors}
            stock={p.stock}
          />
        ))}
      </div>
    </section>
  );
}
