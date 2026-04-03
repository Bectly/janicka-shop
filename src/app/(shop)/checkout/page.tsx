"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { createOrder, type CheckoutState } from "./actions";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [state, dispatch, isPending] = useActionState<CheckoutState, FormData>(
    createOrder,
    { error: null, fieldErrors: {} }
  );

  if (!mounted) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-bold">Objednávka</h1>
        <p className="mt-4 text-muted-foreground">Načítání...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <ShoppingBag className="mx-auto size-12 text-muted-foreground/40" />
        <h1 className="mt-4 font-heading text-2xl font-bold">
          Košík je prázdný
        </h1>
        <p className="mt-2 text-muted-foreground">
          Nejdříve si přidejte něco do košíku.
        </p>
        <Button className="mt-6" render={<Link href="/products" />}>
          Prohlédnout produkty
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/cart"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zpět do košíku
      </Link>

      <h1 className="font-heading text-3xl font-bold">Objednávka</h1>

      {state.error && (
        <div className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <form action={dispatch} className="mt-8">
        {/* Hidden cart data */}
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(
            items.map((i) => ({
              productId: i.productId,
              name: i.name,
              price: i.price,
              size: i.size,
              color: i.color,
              quantity: i.quantity,
            }))
          )}
        />

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact + Shipping form */}
          <div className="space-y-6 lg:col-span-2">
            {/* Contact info */}
            <section className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="font-heading text-lg font-semibold">
                Kontaktní údaje
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Jméno</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    required
                    placeholder="Jana"
                    autoComplete="given-name"
                  />
                  {state.fieldErrors.firstName && (
                    <p className="text-xs text-destructive">
                      {state.fieldErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Příjmení</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    required
                    placeholder="Nováková"
                    autoComplete="family-name"
                  />
                  {state.fieldErrors.lastName && (
                    <p className="text-xs text-destructive">
                      {state.fieldErrors.lastName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="jana@email.cz"
                    autoComplete="email"
                  />
                  {state.fieldErrors.email && (
                    <p className="text-xs text-destructive">
                      {state.fieldErrors.email}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="+420 123 456 789"
                    autoComplete="tel"
                  />
                  {state.fieldErrors.phone && (
                    <p className="text-xs text-destructive">
                      {state.fieldErrors.phone}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Shipping address */}
            <section className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="font-heading text-lg font-semibold">
                Doručovací adresa
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="street">Ulice a číslo popisné</Label>
                  <Input
                    id="street"
                    name="street"
                    required
                    placeholder="Květná 15"
                    autoComplete="street-address"
                  />
                  {state.fieldErrors.street && (
                    <p className="text-xs text-destructive">
                      {state.fieldErrors.street}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Město</Label>
                  <Input
                    id="city"
                    name="city"
                    required
                    placeholder="Praha"
                    autoComplete="address-level2"
                  />
                  {state.fieldErrors.city && (
                    <p className="text-xs text-destructive">
                      {state.fieldErrors.city}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">PSČ</Label>
                  <Input
                    id="zip"
                    name="zip"
                    required
                    placeholder="110 00"
                    autoComplete="postal-code"
                  />
                  {state.fieldErrors.zip && (
                    <p className="text-xs text-destructive">
                      {state.fieldErrors.zip}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Note */}
            <section className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="font-heading text-lg font-semibold">
                Poznámka k objednávce
              </h2>
              <div className="mt-4">
                <Textarea
                  id="note"
                  name="note"
                  rows={3}
                  placeholder="Máte speciální přání? Napište nám..."
                />
              </div>
            </section>
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4 rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="font-heading text-lg font-semibold">
                Shrnutí objednávky
              </h2>

              <div className="divide-y">
                {items.map((item) => (
                  <div
                    key={`${item.productId}-${item.size}-${item.color}`}
                    className="flex justify-between gap-2 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.name}
                      </p>
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

              <div className="border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mezisoučet</span>
                  <span>{formatPrice(totalPrice())}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">Doprava</span>
                  <span className="text-emerald-600">Zdarma</span>
                </div>
                <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold">
                  <span>Celkem</span>
                  <span>{formatPrice(totalPrice())}</span>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isPending}
              >
                {isPending ? "Odesílám objednávku..." : "Odeslat objednávku"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Platba na dobírku — zaplatíte při převzetí
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
