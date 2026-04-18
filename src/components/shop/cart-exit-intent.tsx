"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";

const SESSION_KEY = "janicka-exit-shown";

export function CartExitIntent() {
  const [show, setShow] = useState(false);
  const items = useCartStore((s) => s.items);

  const handleClose = useCallback(() => {
    setShow(false);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;

    // Only show once per session
    if (sessionStorage.getItem(SESSION_KEY)) return;

    function handleMouseLeave(e: MouseEvent) {
      // Only trigger when cursor moves toward top of viewport (leaving the page)
      if (e.clientY > 10) return;

      sessionStorage.setItem(SESSION_KEY, "1");
      setShow(true);
      document.removeEventListener("mouseout", handleMouseLeave);
    }

    document.addEventListener("mouseout", handleMouseLeave);
    return () => document.removeEventListener("mouseout", handleMouseLeave);
  }, [items.length]);

  if (!show || items.length === 0) return null;

  // Show up to 3 product images
  const displayItems = items.slice(0, 3);
  const remaining = items.length - displayItems.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Opravdu chcete odejít?"
    >
      <div className="relative w-full max-w-sm animate-in fade-in zoom-in-95 rounded-2xl border bg-card p-6 shadow-xl">
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          aria-label="Zavřít"
        >
          <X className="size-5" />
        </button>

        <div className="text-center">
          <ShoppingBag className="mx-auto size-10 text-primary" />
          <h2 className="mt-3 font-heading text-lg font-bold text-foreground">
            Neodbíhejte!
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {items.length === 1
              ? "Tento kousek je unikát — kdokoliv ho může koupit."
              : "Tyto kousky jsou unikáty — kdokoliv je může koupit."}
          </p>
        </div>

        {/* Product preview */}
        <div className="mt-4 flex justify-center gap-2">
          {displayItems.map((item) => (
            <div
              key={item.productId}
              className="size-16 shrink-0 overflow-hidden rounded-lg border bg-muted"
            >
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.name}
                  width={64}
                  height={64}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-muted-foreground/40">
                  {item.name.charAt(0)}
                </div>
              )}
            </div>
          ))}
          {remaining > 0 && (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border bg-muted text-sm font-medium text-muted-foreground">
              +{remaining}
            </div>
          )}
        </div>

        <div className="mt-5 space-y-2">
          <Button
            className="w-full"
            render={<Link href="/checkout" />}
            onClick={handleClose}
          >
            Dokončit objednávku
          </Button>
          <button
            onClick={handleClose}
            className="w-full py-2 text-center text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Ještě si to rozmyslím
          </button>
        </div>
      </div>
    </div>
  );
}
