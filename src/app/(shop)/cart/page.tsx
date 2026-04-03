"use client";

import Link from "next/link";
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore, type CartItem } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

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

      <div className="mt-8 divide-y">
        {items.map((item) => (
          <CartItemRow
            key={`${item.productId}-${item.size}-${item.color}`}
            item={item}
            onRemove={() => removeItem(item.productId, item.size, item.color)}
            onUpdateQuantity={(qty) =>
              updateQuantity(item.productId, item.size, item.color, qty)
            }
          />
        ))}
      </div>

      {/* Summary */}
      <div className="mt-8 rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>Celkem</span>
          <span>{formatPrice(totalPrice())}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Doprava se vypočítá v dalším kroku
        </p>
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
    </div>
  );
}

function CartItemRow({
  item,
  onRemove,
  onUpdateQuantity,
}: {
  item: CartItem;
  onRemove: () => void;
  onUpdateQuantity: (qty: number) => void;
}) {
  return (
    <div className="flex gap-4 py-4">
      {/* Image placeholder */}
      <div className="size-20 shrink-0 rounded-lg bg-muted">
        <div className="flex size-full items-center justify-center text-lg text-muted-foreground/30">
          {item.name.charAt(0)}
        </div>
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
            {formatPrice(item.price * item.quantity)}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2">
          {/* Quantity controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onUpdateQuantity(item.quantity - 1)}
              className="inline-flex size-7 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Odebrat 1"
            >
              <Minus className="size-3" />
            </button>
            <span className="w-8 text-center text-sm font-medium">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.quantity + 1)}
              className="inline-flex size-7 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Přidat 1"
            >
              <Plus className="size-3" />
            </button>
          </div>

          <button
            onClick={onRemove}
            className="text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Odebrat z košíku"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
