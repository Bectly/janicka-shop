"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, Check, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";

interface MobileStickyAtcProps {
  productName: string;
  price: number;
  isInCart: boolean;
  isReservedByOther: boolean;
  stock: number;
  isPending: boolean;
  onAdd: () => void;
}

export function MobileStickyAtc({
  productName,
  price,
  isInCart,
  isReservedByOther,
  stock,
  isPending,
  onAdd,
}: MobileStickyAtcProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Watch when the main add-to-cart section scrolls out of view
    const sentinel = document.getElementById("atc-sentinel");
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const disabled = stock === 0 || isPending || isInCart || isReservedByOther;

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{productName}</p>
          <p className="text-sm font-bold">{formatPrice(price)}</p>
        </div>
        <Button
          size="lg"
          className="shrink-0"
          onClick={onAdd}
          disabled={disabled}
        >
          {isPending ? (
            <Loader2 data-icon="inline-start" className="size-4 animate-spin" />
          ) : isInCart ? (
            <>
              <Check data-icon="inline-start" className="size-4" />
              V košíku
            </>
          ) : isReservedByOther ? (
            <>
              <Clock data-icon="inline-start" className="size-4" />
              Rezervováno
            </>
          ) : stock === 0 ? (
            "Nedostupné"
          ) : (
            <>
              <ShoppingBag data-icon="inline-start" className="size-4" />
              Do košíku
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
