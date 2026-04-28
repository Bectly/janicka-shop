import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WishlistEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
      <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-background shadow-sm">
        <Heart className="size-6 text-muted-foreground/40" />
      </div>
      <p className="mt-5 text-base font-medium text-foreground">
        Zatím nemáš žádné oblíbené kousky
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Klikni na srdíčko u produktu a přidej si ho sem — každý kus je unikát.
      </p>
      <Button size="lg" className="mt-6" render={<Link href="/products" />}>
        <ShoppingBag className="mr-2 size-4" />
        Prohlédnout kolekci
      </Button>
    </div>
  );
}
