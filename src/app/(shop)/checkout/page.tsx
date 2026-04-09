"use client";

import {
  useActionState,
  useState,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
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
  Check,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/format";
import { trackBeginCheckout } from "@/lib/analytics";
import {
  createOrder,
  captureAbandonedCart,
  type CheckoutState,
} from "./actions";
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

// ---------------------------------------------------------------------------
// Accordion checkout step
// ---------------------------------------------------------------------------

function CheckoutStep({
  step,
  title,
  activeStep,
  completedSteps,
  summary,
  onEdit,
  children,
}: {
  step: number;
  title: string;
  activeStep: number;
  completedSteps: Set<number>;
  summary?: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const isActive = activeStep === step;
  const isCompleted = completedSteps.has(step);
  const isAccessible = step <= activeStep || isCompleted;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header — clickable when completed (to re-edit) */}
      <button
        type="button"
        onClick={isCompleted && !isActive ? onEdit : undefined}
        disabled={!isCompleted || isActive}
        className={`flex w-full items-center gap-3 p-4 sm:p-6 text-left transition-colors ${
          isCompleted && !isActive
            ? "cursor-pointer hover:bg-muted/50"
            : "cursor-default"
        }`}
      >
        {/* Step indicator */}
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
            isCompleted
              ? "bg-emerald-100 text-emerald-700"
              : isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {isCompleted ? <Check className="size-4" /> : step + 1}
        </div>

        {/* Title + summary */}
        <div className="min-w-0 flex-1">
          <h2
            className={`font-heading text-base font-semibold ${
              !isAccessible ? "text-muted-foreground" : ""
            }`}
          >
            {title}
          </h2>
          {isCompleted && !isActive && summary && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {summary}
            </p>
          )}
        </div>

        {/* Edit link for completed steps */}
        {isCompleted && !isActive && (
          <span className="shrink-0 text-sm font-medium text-primary">
            Upravit
          </span>
        )}
      </button>

      {/* Collapsible content */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isActive
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden" inert={!isActive}>
          <div className="px-4 pb-6 sm:px-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main checkout page
// ---------------------------------------------------------------------------

export default function CheckoutPage() {
  const items = useCartStore((s) => s.items);
  const totalPrice = useCartStore((s) => s.totalPrice);
  const [paymentMethod, setPaymentMethod] = useState<string>("card");
  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>("packeta_pickup");
  const [packetaPoint, setPacketaPoint] = useState<PacketaPoint | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  // Accordion state
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    new Set(),
  );

  // Form field refs for validation + summaries
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const streetRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  // Track whether email has been captured to trigger marketingConsent re-capture
  const emailCapturedRef = useRef(false);

  const [state, dispatch, isPending] = useActionState<CheckoutState, FormData>(
    createOrder,
    { error: null, fieldErrors: {} },
  );

  const handlePacketaPointSelected = useCallback(
    (point: PacketaPoint | null) => {
      setPacketaPoint(point);
      if (point) setShippingError(null);
    },
    [],
  );

  // Capture abandoned cart when email field loses focus
  const handleEmailBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const email = e.target.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
      if (items.length === 0) return;

      emailCapturedRef.current = true;
      const firstName = firstNameRef.current?.value.trim();
      const lastName = lastNameRef.current?.value.trim();
      const customerName =
        firstName && lastName ? `${firstName} ${lastName}` : undefined;

      captureAbandonedCart({
        email,
        customerName,
        cartItems: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          size: i.size,
          color: i.color,
          image: i.image,
          slug: i.slug,
        })),
        cartTotal: totalPrice(),
        marketingConsent,
      }).catch(() => {});
    },
    [items, totalPrice, marketingConsent],
  );

  // Fire begin_checkout analytics event once on mount
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (checkoutTracked.current || !mounted || items.length === 0) return;
    checkoutTracked.current = true;
    trackBeginCheckout(
      items.map((i) => ({ id: i.productId, name: i.name, price: i.price })),
      totalPrice(),
    );
  }, [mounted, items, totalPrice]);

  // Re-capture abandoned cart with updated marketingConsent when user checks/unchecks
  // the opt-in box AFTER blurring the email field. Without this, the captured record
  // always has marketingConsent=false because the blur fires before onChange.
  useEffect(() => {
    if (!emailCapturedRef.current) return; // email not entered yet
    const email = emailRef.current?.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (items.length === 0) return;

    const firstName = firstNameRef.current?.value.trim();
    const lastName = lastNameRef.current?.value.trim();
    const customerName =
      firstName && lastName ? `${firstName} ${lastName}` : undefined;

    captureAbandonedCart({
      email,
      customerName,
      cartItems: items.map((i) => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        size: i.size,
        color: i.color,
        image: i.image,
        slug: i.slug,
      })),
      cartTotal: totalPrice(),
      marketingConsent,
    }).catch(() => {});
    // Intentionally only marketingConsent in deps — fires only when consent changes,
    // not on every cart/price update (those are captured at email blur).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketingConsent]);

  // If server action returned field errors, open the relevant step
  useEffect(() => {
    if (!state.fieldErrors || Object.keys(state.fieldErrors).length === 0)
      return;

    const contactFields = ["firstName", "lastName", "email", "phone"];
    const shippingFields = [
      "shippingMethod",
      "packetaPointId",
      "street",
      "city",
      "zip",
    ];
    const paymentFields = ["paymentMethod"];

    const errorKeys = Object.keys(state.fieldErrors);
    if (errorKeys.some((k) => contactFields.includes(k))) {
      setContactError(null); // per-field errors will show instead
      setActiveStep(0);
      // Remove step 0 from completed so user can fix
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.delete(0);
        return next;
      });
    } else if (errorKeys.some((k) => shippingFields.includes(k))) {
      setShippingError(null); // per-field errors will show instead
      setActiveStep(1);
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.delete(1);
        return next;
      });
    } else if (errorKeys.some((k) => paymentFields.includes(k))) {
      setActiveStep(2);
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.delete(2);
        return next;
      });
    }
  }, [state.fieldErrors]);

  const isPacketaPickup = shippingMethod === "packeta_pickup";
  const isCod = paymentMethod === "cod";
  const subtotal = totalPrice();
  const shippingOption = SHIPPING_OPTIONS.find((o) => o.id === shippingMethod);
  const baseShipping = shippingOption?.price ?? 0;
  const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : baseShipping;
  const codFee = isCod ? COD_SURCHARGE : 0;
  const total = subtotal + shippingCost + codFee;

  // Step validation + advance
  const advanceFromContact = useCallback(() => {
    const firstName = firstNameRef.current?.value.trim();
    const lastName = lastNameRef.current?.value.trim();
    const email = emailRef.current?.value.trim();

    if (!firstName || !lastName || !email) {
      setContactError("Vyplňte prosím jméno, příjmení a email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setContactError("Zadejte platnou emailovou adresu.");
      return;
    }
    setContactError(null);
    setCompletedSteps((prev) => new Set(prev).add(0));
    setActiveStep(1);
  }, []);

  const advanceFromShipping = useCallback(() => {
    if (isPacketaPickup && !packetaPoint) {
      setShippingError("Vyberte prosím výdejní místo Zásilkovny.");
      return;
    }
    if (!isPacketaPickup) {
      const street = streetRef.current?.value.trim();
      const city = cityRef.current?.value.trim();
      const zip = zipRef.current?.value.trim();
      const phone = phoneRef.current?.value.trim();
      if (!street || !city || !zip || !phone) {
        setShippingError("Vyplňte prosím telefonní číslo a doručovací adresu.");
        return;
      }
    }
    setShippingError(null);
    setCompletedSteps((prev) => new Set(prev).add(1));
    setActiveStep(2);
  }, [isPacketaPickup, packetaPoint]);

  const advanceFromPayment = useCallback(() => {
    setCompletedSteps((prev) => new Set(prev).add(2));
    setActiveStep(3);
  }, []);

  // Prevent Enter from bypassing accordion steps and submitting prematurely.
  // Instead, Enter advances the current active step (same as clicking "Pokračovat").
  const handleFormKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLFormElement>) => {
      if (
        e.key !== "Enter" ||
        (e.target as HTMLElement).tagName === "TEXTAREA" ||
        (e.target as HTMLElement).tagName === "BUTTON"
      )
        return;
      e.preventDefault();
      if (activeStep === 0) advanceFromContact();
      else if (activeStep === 1) advanceFromShipping();
      else if (activeStep === 2) advanceFromPayment();
    },
    [activeStep, advanceFromContact, advanceFromShipping, advanceFromPayment],
  );

  // Build inline summaries for completed steps
  const contactSummary =
    (firstNameRef.current?.value || "") +
    " " +
    (lastNameRef.current?.value || "") +
    (emailRef.current?.value ? `, ${emailRef.current.value}` : "");

  const shippingSummary = isPacketaPickup
    ? packetaPoint
      ? `Zásilkovna — ${packetaPoint.name}`
      : "Zásilkovna — výdejní místo"
    : shippingMethod === "packeta_home"
      ? `Na adresu — ${streetRef.current?.value || ""}, ${cityRef.current?.value || ""}`
      : `Česká pošta — ${streetRef.current?.value || ""}, ${cityRef.current?.value || ""}`;

  const paymentSummary =
    PAYMENT_OPTIONS.find((o) => o.id === paymentMethod)?.label ?? "";

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

      <form action={dispatch} className="mt-8" onKeyDown={handleFormKeyDown}>
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
            })),
          )}
        />
        <input type="hidden" name="paymentMethod" value={paymentMethod} />
        <input type="hidden" name="shippingMethod" value={shippingMethod} />
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
          {/* Accordion form steps */}
          <div className="space-y-4 lg:col-span-2">
            {/* Step 1: Contact */}
            <CheckoutStep
              step={0}
              title="Kontaktní údaje"
              activeStep={activeStep}
              completedSteps={completedSteps}
              summary={contactSummary.trim()}
              onEdit={() => {
                setActiveStep(0);
                setCompletedSteps((prev) => {
                  const next = new Set(prev);
                  next.delete(0);
                  next.delete(1);
                  next.delete(2);
                  return next;
                });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Jméno</Label>
                  <Input
                    ref={firstNameRef}
                    id="firstName"
                    name="firstName"
                    required
                    placeholder="Jana"
                    autoComplete="given-name"
                    aria-invalid={!!state.fieldErrors.firstName}
                    aria-describedby={
                      state.fieldErrors.firstName
                        ? "firstName-error"
                        : undefined
                    }
                  />
                  {state.fieldErrors.firstName && (
                    <p
                      id="firstName-error"
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {state.fieldErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Příjmení</Label>
                  <Input
                    ref={lastNameRef}
                    id="lastName"
                    name="lastName"
                    required
                    placeholder="Nováková"
                    autoComplete="family-name"
                    aria-invalid={!!state.fieldErrors.lastName}
                    aria-describedby={
                      state.fieldErrors.lastName ? "lastName-error" : undefined
                    }
                  />
                  {state.fieldErrors.lastName && (
                    <p
                      id="lastName-error"
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {state.fieldErrors.lastName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    ref={emailRef}
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="jana@email.cz"
                    autoComplete="email"
                    onBlur={handleEmailBlur}
                    aria-invalid={!!state.fieldErrors.email}
                    aria-describedby={
                      state.fieldErrors.email ? "email-error" : undefined
                    }
                  />
                  {state.fieldErrors.email && (
                    <p
                      id="email-error"
                      role="alert"
                      className="text-xs text-destructive"
                    >
                      {state.fieldErrors.email}
                    </p>
                  )}
                </div>
              </div>

              {/* GDPR marketing consent */}
              <label className="mt-4 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-primary accent-primary"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  Upozornit mě, pokud zboží v košíku nákoupí někdo jiný. Každý
                  kousek je unikát — kdokoliv ho může koupit.
                </span>
              </label>

              {contactError && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {contactError}
                </p>
              )}
              <Button
                type="button"
                className="mt-6 w-full gap-2"
                onClick={advanceFromContact}
              >
                Pokračovat
                <ChevronRight className="size-4" />
              </Button>
            </CheckoutStep>

            {/* Step 2: Shipping */}
            <CheckoutStep
              step={1}
              title="Doprava"
              activeStep={activeStep}
              completedSteps={completedSteps}
              summary={shippingSummary}
              onEdit={() => {
                setActiveStep(1);
                setCompletedSteps((prev) => {
                  const next = new Set(prev);
                  next.delete(1);
                  next.delete(2);
                  return next;
                });
              }}
            >
              {state.fieldErrors.shippingMethod && (
                <p className="mb-3 text-xs text-destructive">
                  {state.fieldErrors.shippingMethod}
                </p>
              )}

              {subtotal >= FREE_SHIPPING_THRESHOLD && (
                <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <Package className="mr-1.5 inline-block size-4" />
                  Doprava zdarma u objednávek nad{" "}
                  {formatPrice(FREE_SHIPPING_THRESHOLD)}
                </div>
              )}

              <div className="space-y-3">
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
                            setShippingError(null);
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

                      {/* Packeta widget */}
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

              {/* Address — for home delivery */}
              {!isPacketaPickup && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium">Doručovací adresa</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefon</Label>
                      <Input
                        ref={phoneRef}
                        id="phone"
                        name="phone"
                        type="tel"
                        required
                        placeholder="+420 123 456 789"
                        autoComplete="tel"
                        aria-invalid={!!state.fieldErrors.phone}
                        aria-describedby={
                          state.fieldErrors.phone ? "phone-error" : undefined
                        }
                      />
                      {state.fieldErrors.phone && (
                        <p
                          id="phone-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {state.fieldErrors.phone}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="street">Ulice a číslo popisné</Label>
                      <Input
                        ref={streetRef}
                        id="street"
                        name="street"
                        required
                        placeholder="Květná 15"
                        autoComplete="street-address"
                        aria-invalid={!!state.fieldErrors.street}
                        aria-describedby={
                          state.fieldErrors.street ? "street-error" : undefined
                        }
                      />
                      {state.fieldErrors.street && (
                        <p
                          id="street-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {state.fieldErrors.street}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Město</Label>
                      <Input
                        ref={cityRef}
                        id="city"
                        name="city"
                        required
                        placeholder="Praha"
                        autoComplete="address-level2"
                        aria-invalid={!!state.fieldErrors.city}
                        aria-describedby={
                          state.fieldErrors.city ? "city-error" : undefined
                        }
                      />
                      {state.fieldErrors.city && (
                        <p
                          id="city-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {state.fieldErrors.city}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">PSČ</Label>
                      <Input
                        ref={zipRef}
                        id="zip"
                        name="zip"
                        required
                        placeholder="110 00"
                        autoComplete="postal-code"
                        aria-invalid={!!state.fieldErrors.zip}
                        aria-describedby={
                          state.fieldErrors.zip ? "zip-error" : undefined
                        }
                      />
                      {state.fieldErrors.zip && (
                        <p
                          id="zip-error"
                          role="alert"
                          className="text-xs text-destructive"
                        >
                          {state.fieldErrors.zip}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {shippingError && (
                <p role="alert" className="mt-4 text-sm text-destructive">
                  {shippingError}
                </p>
              )}
              <Button
                type="button"
                className="mt-6 w-full gap-2"
                onClick={advanceFromShipping}
              >
                Pokračovat
                <ChevronRight className="size-4" />
              </Button>
            </CheckoutStep>

            {/* Step 3: Payment */}
            <CheckoutStep
              step={2}
              title="Platba"
              activeStep={activeStep}
              completedSteps={completedSteps}
              summary={paymentSummary}
              onEdit={() => {
                setActiveStep(2);
                setCompletedSteps((prev) => {
                  const next = new Set(prev);
                  next.delete(2);
                  return next;
                });
              }}
            >
              {state.fieldErrors.paymentMethod && (
                <p className="mb-3 text-xs text-destructive">
                  {state.fieldErrors.paymentMethod}
                </p>
              )}
              <div className="space-y-3">
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

              {/* Inline trust badge */}
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
                <Lock className="size-4 shrink-0" />
                <span>
                  <span className="font-medium">Zabezpečená platba</span>
                  {" — "}
                  vaše údaje jsou šifrovány a v bezpečí
                </span>
              </div>

              <Button
                type="button"
                className="mt-6 w-full gap-2"
                onClick={advanceFromPayment}
              >
                Pokračovat ke shrnutí
                <ChevronRight className="size-4" />
              </Button>
            </CheckoutStep>

            {/* Step 4: Summary + Note + Submit */}
            <CheckoutStep
              step={3}
              title="Shrnutí a odeslání"
              activeStep={activeStep}
              completedSteps={completedSteps}
              onEdit={() => setActiveStep(3)}
            >
              {/* Order items summary */}
              <div className="divide-y rounded-lg border">
                {items.map((item) => (
                  <div
                    key={`${item.productId}-${item.size}-${item.color}`}
                    className="flex items-center gap-3 p-3"
                  >
                    {item.image && (
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
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

              {/* Price breakdown */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mezisoučet</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Doprava</span>
                  {shippingCost === 0 ? (
                    <span className="text-emerald-600">Zdarma</span>
                  ) : (
                    <span>{formatPrice(shippingCost)}</span>
                  )}
                </div>
                {isCod && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Dobírka</span>
                    <span>{formatPrice(COD_SURCHARGE)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2 text-lg font-bold">
                  <span>Celkem</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              {/* Note */}
              <div className="mt-6">
                <Label htmlFor="note">Poznámka k objednávce</Label>
                <Textarea
                  id="note"
                  name="note"
                  rows={2}
                  className="mt-2"
                  placeholder="Máte speciální přání? Napište nám..."
                />
              </div>

              <Button
                type="submit"
                size="lg"
                className="mt-6 w-full"
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
            </CheckoutStep>
          </div>

          {/* Desktop order summary sidebar */}
          <div className="hidden lg:col-span-1 lg:block">
            <div className="sticky top-24 space-y-4 rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="font-heading text-lg font-semibold">
                Vaše objednávka
              </h2>

              <div className="divide-y">
                {items.map((item) => (
                  <div
                    key={`${item.productId}-${item.size}-${item.color}`}
                    className="flex items-center gap-3 py-3"
                  >
                    {item.image && (
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
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
            </div>
          </div>
        </div>

        {/* Mobile bottom padding for sticky bar */}
        <div className="h-16 lg:hidden" />
      </form>

      {/* Mobile sticky summary bar */}
      <MobileCheckoutSummary
        items={items.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          size: i.size,
          color: i.color,
          image: i.image,
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
