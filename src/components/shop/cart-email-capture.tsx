"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureCartEmail } from "@/lib/actions/cart-email";
import { useCartStore } from "@/lib/cart-store";

/**
 * Inline email capture on the cart page.
 * Captures email early in funnel for abandoned cart recovery.
 * Only shown if cart has items. Disappears after successful capture.
 */
export function CartEmailCapture() {
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0 || captured) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !consent) return;

    startTransition(async () => {
      await captureCartEmail({
        email,
        cartItems: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          size: i.size || undefined,
          color: i.color || undefined,
          image: i.image || undefined,
          slug: i.slug || undefined,
        })),
        cartTotal: totalPrice(),
        marketingConsent: consent,
      });
      setCaptured(true);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Mail className="size-4 text-primary/70" />
        Chceš vědět, když ti někdo kousek přebere?
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Zadej email a dáme ti vědět, pokud něco z košíku zmizí.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tvuj@email.cz"
          required
          autoComplete="email"
          className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="submit" size="sm" disabled={isPending || !consent}>
          {isPending ? "Ukládám..." : "Uložit"}
        </Button>
      </div>
      <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-4 cursor-pointer rounded accent-primary"
        />
        Souhlasím se zasíláním upomínek o košíku na tento email
      </label>
    </form>
  );
}
