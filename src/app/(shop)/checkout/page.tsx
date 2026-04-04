"use client";

import { useActionState, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingBag,
  CreditCard,
  Landmark,
  Truck,
  Package,
  MapPin,
  Home,
  Mail,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { createOrder, type CheckoutState } from "./actions";
import { useSyncExternalStore } from "react";
import {
  PacketaWidget,
  type PacketaPoint,
} from "@/components/shop/packeta-widget";
import {
  SHIPPING_PRICES,
  FREE_SHIPPING_THRESHOLD,
  COD_SURCHARGE,
} from "@/lib/constants";
import { MobileCheckoutSummary } from "@/components/shop/mobile-checkout-summary";

const emptySubscribe = () => () => {};

const SHIPPING_OPTIONS = [
  {
    id: "packeta_pickup" as const,
    label: "Zásilkovna — výdejní místo",
    description: "Vyzvednutí na vybraném místě, obvykle 2–3 dny",
    price: SHIPPING_PRICES.packeta_pickup,
    icon: MapPin,
  },
  {
    id: "packeta_home" as const,
    label: "Zásilkovna — na adresu",
    description: "Doručení domů, obvykle 2–3 dny",
    price: SHIPPING_PRICES.packeta_home,
    icon: Home,
  },
  {
    id: "czech_post" as const,
    label: "Česká pošta",
    description: "Doporučený balík, obvykle 3–5 dní",
    price: SHIPPING_PRICES.czech_post,
    icon: Mail,
  },
] as const;

const PAYMENT_OPTIONS = [
  {
    id: "card" as const,
    label: "Kartou online",
    description: "Visa, Mastercard, Apple Pay, Google Pay",
    icon: CreditCard,
  },
  {
    id: "bank_transfer" as const,
    label: "Bankovním převodem",
    description: "Online platba přes vaši banku",
    icon: Landmark,
  },
  {
    id: "cod" as const,
    label: "Dobírka",
    description: `Platba při převzetí (+${COD_SURCHARGE} Kč)`,
    icon: Truck,
  },
] as const;

type ShippingMethod = (typeof SHIPPING_OPTIONS)[number]["id"];

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const [paymentMethod, setPaymentMethod] = useState<string>("card");
  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>("packeta_pickup");
  const [packetaPoint, setPacketaPoint] = useState<PacketaPoint | null>(null);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [state, dispatch, isPending] = useActionState<CheckoutState, FormData>(
    createOrder,
    { error: null, fieldErrors: {} }
  );

  const handlePacketaPointSelected = useCallback(
    (point: PacketaPoint | null) => {
      setPacketaPoint(point);
    },
    []
  );

  const isCod = paymentMethod === "cod";
  const isPacketaPickup = shippingMethod === "packeta_pickup";
  const subtotal = totalPrice();

  // Free shipping for orders above threshold
  const shippingOption = SHIPPING_OPTIONS.find((o) => o.id === shippingMethod);
  const baseShipping = shippingOption?.price ?? 0;
  const shippingCost =
    subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : baseShipping;
  const codFee = isCod ? COD_SURCHARGE : 0;
  const total = subtotal + shippingCost + codFee;

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
        <div
          role="alert"
          className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
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
        <input type="hidden" name="paymentMethod" value={paymentMethod} />
        <input type="hidden" name="shippingMethod" value={shippingMethod} />
        {/* Packeta point data */}
        {packetaPoint && (
          <>
            <input
              type="hidden"
              name="packetaPointId"
              value={packetaPoint.id}
            />
            <input
              type="hidden"
              name="packetaPointName"
              value={packetaPoint.name}
            />
            <input
              type="hidden"
              name="packetaPointAddress"
              value={`${packetaPoint.street}, ${packetaPoint.zip} ${packetaPoint.city}`}
            />
          </>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Contact + Shipping + Payment form */}
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
                    aria-invalid={!!state.fieldErrors.firstName}
                    aria-describedby={state.fieldErrors.firstName ? "firstName-error" : undefined}
                  />
                  {state.fieldErrors.firstName && (
                    <p id="firstName-error" role="alert" className="text-xs text-destructive">
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
                    aria-invalid={!!state.fieldErrors.lastName}
                    aria-describedby={state.fieldErrors.lastName ? "lastName-error" : undefined}
                  />
                  {state.fieldErrors.lastName && (
                    <p id="lastName-error" role="alert" className="text-xs text-destructive">
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
                    aria-invalid={!!state.fieldErrors.email}
                    aria-describedby={state.fieldErrors.email ? "email-error" : undefined}
                  />
                  {state.fieldErrors.email && (
                    <p id="email-error" role="alert" className="text-xs text-destructive">
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
                    aria-invalid={!!state.fieldErrors.phone}
                    aria-describedby={state.fieldErrors.phone ? "phone-error" : undefined}
                  />
                  {state.fieldErrors.phone && (
                    <p id="phone-error" role="alert" className="text-xs text-destructive">
                      {state.fieldErrors.phone}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Shipping method selection */}
            <section className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="font-heading text-lg font-semibold">
                Způsob dopravy
              </h2>
              {state.fieldErrors.shippingMethod && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.shippingMethod}
                </p>
              )}

              {subtotal >= FREE_SHIPPING_THRESHOLD && (
                <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <Package className="mr-1.5 inline-block size-4" />
                  Doprava zdarma u objednávek nad{" "}
                  {formatPrice(FREE_SHIPPING_THRESHOLD)}
                </div>
              )}

              <div className="mt-4 space-y-3">
                {SHIPPING_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = shippingMethod === option.id;
                  const isFree = subtotal >= FREE_SHIPPING_THRESHOLD;
                  return (
                    <div key={option.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-4 rounded-lg border-2 p-4 transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="shippingMethodRadio"
                          value={option.id}
                          checked={isSelected}
                          onChange={() => {
                            setShippingMethod(option.id);
                            // Clear packeta point when switching away
                            if (option.id !== "packeta_pickup") {
                              setPacketaPoint(null);
                            }
                          }}
                          className="sr-only"
                        />
                        <div
                          className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            isSelected
                              ? "border-primary"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && (
                            <div className="size-2.5 rounded-full bg-primary" />
                          )}
                        </div>
                        <Icon
                          className={`size-5 shrink-0 ${
                            isSelected
                              ? "text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{option.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold">
                          {isFree ? (
                            <span className="text-emerald-600">Zdarma</span>
                          ) : (
                            formatPrice(option.price)
                          )}
                        </span>
                      </label>

                      {/* Packeta widget — shown when packeta_pickup selected */}
                      {option.id === "packeta_pickup" && isSelected && (
                        <div className="mt-3 ml-9">
                          <PacketaWidget
                            onPointSelected={handlePacketaPointSelected}
                            selectedPoint={packetaPoint}
                          />
                          {state.fieldErrors.packetaPointId && (
                            <p className="mt-1 text-xs text-destructive">
                              {state.fieldErrors.packetaPointId}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Shipping address — shown for home delivery methods */}
            {!isPacketaPickup && (
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
                      aria-invalid={!!state.fieldErrors.street}
                      aria-describedby={state.fieldErrors.street ? "street-error" : undefined}
                    />
                    {state.fieldErrors.street && (
                      <p id="street-error" role="alert" className="text-xs text-destructive">
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
                      aria-invalid={!!state.fieldErrors.city}
                      aria-describedby={state.fieldErrors.city ? "city-error" : undefined}
                    />
                    {state.fieldErrors.city && (
                      <p id="city-error" role="alert" className="text-xs text-destructive">
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
                      aria-invalid={!!state.fieldErrors.zip}
                      aria-describedby={state.fieldErrors.zip ? "zip-error" : undefined}
                    />
                    {state.fieldErrors.zip && (
                      <p id="zip-error" role="alert" className="text-xs text-destructive">
                        {state.fieldErrors.zip}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Payment method selection */}
            <section className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="font-heading text-lg font-semibold">
                Způsob platby
              </h2>
              {state.fieldErrors.paymentMethod && (
                <p className="mt-1 text-xs text-destructive">
                  {state.fieldErrors.paymentMethod}
                </p>
              )}
              <div className="mt-4 space-y-3">
                {PAYMENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isSelected = paymentMethod === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center gap-4 rounded-lg border-2 p-4 transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="paymentMethodRadio"
                        value={option.id}
                        checked={isSelected}
                        onChange={() => setPaymentMethod(option.id)}
                        className="sr-only"
                      />
                      <div
                        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected
                            ? "border-primary"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected && (
                          <div className="size-2.5 rounded-full bg-primary" />
                        )}
                      </div>
                      <Icon
                        className={`size-5 shrink-0 ${
                          isSelected
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Inline trust badge — 40-60% better conversion than footer placement */}
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                <Lock className="size-4 shrink-0" />
                <span>
                  <span className="font-medium">Zabezpečená platba</span>
                  {" — "}
                  vaše údaje jsou šifrovány a v bezpečí
                </span>
              </div>
            </section>

            {/* Note */}
            <section className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="font-heading text-lg font-semibold">
                Poznámka k objednávce
              </h2>
              <div className="mt-4">
                <Label htmlFor="note" className="sr-only">Poznámka k objednávce</Label>
              <Textarea
                  id="note"
                  name="note"
                  rows={3}
                  placeholder="Máte speciální přání? Napište nám..."
                />
              </div>
            </section>
          </div>

          {/* Order summary sidebar — hidden on mobile, shown on desktop */}
          <div className="hidden lg:col-span-1 lg:block">
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
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">Doprava</span>
                  {shippingCost === 0 ? (
                    <span className="text-emerald-600">Zdarma</span>
                  ) : (
                    <span>{formatPrice(shippingCost)}</span>
                  )}
                </div>
                {isCod && (
                  <div className="mt-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Dobírka</span>
                    <span>{formatPrice(COD_SURCHARGE)}</span>
                  </div>
                )}
                <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold">
                  <span>Celkem</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isPending}
              >
                {isPending
                  ? "Zpracovávám..."
                  : isCod
                    ? "Objednat na dobírku"
                    : "Přejít k platbě"}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                {isCod
                  ? `Zaplatíte ${formatPrice(total)} při převzetí zásilky`
                  : "Budete přesměrováni na bezpečnou platební bránu"}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile submit button + bottom padding to avoid overlap with sticky bar */}
        <div className="mt-6 lg:hidden">
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isPending}
          >
            {isPending
              ? "Zpracovávám..."
              : isCod
                ? "Objednat na dobírku"
                : "Přejít k platbě"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {isCod
              ? `Zaplatíte ${formatPrice(total)} při převzetí zásilky`
              : "Budete přesměrováni na bezpečnou platební bránu"}
          </p>
          {/* Spacer for mobile sticky bar */}
          <div className="h-16" />
        </div>
      </form>

      {/* Mobile sticky summary bar */}
      <MobileCheckoutSummary
        items={items.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          size: i.size,
          color: i.color,
        }))}
        subtotal={subtotal}
        shippingCost={shippingCost}
        codFee={codFee}
        total={total}
        freeShipping={shippingCost === 0}
      />
    </div>
  );
}
