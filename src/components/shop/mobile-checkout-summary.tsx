"use client";

import { ChevronUp, ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface CartItem {
  productId: string;
  name: string;
  price: number;
  size: string;
  color: string;
}

interface MobileCheckoutSummaryProps {
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  codFee: number;
  total: number;
  freeShipping: boolean;
}

export function MobileCheckoutSummary({
  items,
  subtotal,
  shippingCost,
  codFee,
  total,
  freeShipping,
}: MobileCheckoutSummaryProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-sm lg:hidden">
      <Sheet>
        <SheetTrigger className="flex w-full items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {items.length} {items.length === 1 ? "položka" : items.length < 5 ? "položky" : "položek"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">{formatPrice(total)}</span>
            <ChevronUp className="size-4 text-muted-foreground" />
          </div>
        </SheetTrigger>
        <SheetContent side="bottom" showCloseButton={false} className="max-h-[70vh]">
          <SheetHeader className="border-b pb-3">
            <SheetTitle>Shrnutí objednávky</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 py-3">
            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.size}-${item.color}`}
                  className="flex justify-between gap-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.size}
                      {item.color && ` · ${item.color}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium">
                    {formatPrice(item.price)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mezisoučet</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-muted-foreground">Doprava</span>
                {freeShipping ? (
                  <span className="text-emerald-600">Zdarma</span>
                ) : (
                  <span>{formatPrice(shippingCost)}</span>
                )}
              </div>
              {codFee > 0 && (
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">Dobírka</span>
                  <span>{formatPrice(codFee)}</span>
                </div>
              )}
              <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold">
                <span>Celkem</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
