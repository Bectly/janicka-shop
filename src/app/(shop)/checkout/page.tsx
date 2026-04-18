"use client";

import {
  useActionState,
  useState,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useSearchParams } from "next/navigation";
import { getPersistedReferralCode, clearPersistedReferralCode } from "@/components/shop/referral-tracker";
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
  Gift,
  Tag,
  ShieldCheck,
  RotateCcw,
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
  validateCheckoutDiscounts,
  type CheckoutState,
} from "./actions";
import { ComgatePaymentSection } from "@/components/shop/checkout/comgate-payment-section";
import { ExpressCheckoutButtons } from "@/components/shop/checkout/express-checkout-buttons";
import {
  PacketaWidget,
  type PacketaPoint,
} from "@/components/shop/packeta-widget";
import {
  AddressAutocomplete,
  type AddressSuggestion,
} from "@/components/shop/address-autocomplete";
import {
  SHIPPING_PRICES,
  FREE_SHIPPING_THRESHOLD,
  COD_SURCHARGE,
} from "@/lib/constants";
import { MobileCheckoutSummary } from "@/components/shop/mobile-checkout-summary";
import { CUSTOMER_EMAIL_KEY } from "@/components/shop/browse-abandonment-tracker";

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
    description: "Visa, Mastercard, Apple Pay, Google Pay — platba na místě",
    icon: CreditCard,
  },
  {
    id: "bank_transfer" as const,
    label: "Bankovním převodem",
    description: "Online platba přes vaši banku — přesměrování na Comgate",
    icon: Landmark,
  },
  {
    id: "cod" as const,
    label: "Dobírka",
    description: `Platba při převzetí zásilky (+${COD_SURCHARGE} Kč)`,
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
        className={`flex w-full items-center gap-3 p-4 sm:p-6 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
          isCompleted && !isActive
            ? "cursor-pointer hover:bg-muted/50"
            : "cursor-default"
        }`}
      >
        {/* Step indicator */}
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-200 ${
            isCompleted
              ? "bg-sage-light text-sage-dark ring-1 ring-sage/30"
              : isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {isCompleted ? <Check className="size-4 animate-in zoom-in-50 duration-200" /> : step + 1}
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
          <div className="px-4 pt-4 pb-6 sm:px-6 sm:pt-6">{children}</div>
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
  const clearCart = useCartStore((s) => s.clearCart);
  const searchParams = useSearchParams();
  const [paymentMethod, setPaymentMethod] = useState<string>("card");
  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>("packeta_pickup");
  const [packetaPoint, setPacketaPoint] = useState<PacketaPoint | null>(null);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  // Referral & store credit — read from URL first, fall back to sessionStorage
  const [referralCode, setReferralCode] = useState<string | null>(() => {
    const fromUrl = searchParams.get("ref")?.trim().toUpperCase();
    if (fromUrl) return fromUrl;
    return getPersistedReferralCode();
  });
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [storeCredit, setStoreCredit] = useState(0);
  const [, startDiscountTransition] = useTransition();
  const discountFetchedForRef = useRef<string | null>(null);
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

  // Auto-fill city + ZIP when user selects an address suggestion
  const handleAddressSelect = useCallback(
    (suggestion: AddressSuggestion) => {
      if (cityRef.current) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(cityRef.current, suggestion.city);
        cityRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (zipRef.current) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(zipRef.current, suggestion.zip);
        zipRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
    },
    [],
  );

  // Capture abandoned cart when email field loses focus
  const handleEmailBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const email = e.target.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

      // Persist email for browse abandonment tracking
      try { localStorage.setItem(CUSTOMER_EMAIL_KEY, email.toLowerCase()); } catch { /* */ }

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
  // Apply store credit up to the remaining amount after other discounts
  const preDiscountTotal = subtotal + shippingCost + codFee - referralDiscount;
  const effectiveStoreCredit = Math.min(storeCredit, Math.max(0, preDiscountTotal));
  const total = Math.max(0, preDiscountTotal - effectiveStoreCredit);

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

    // Validate referral code + check store credit once we have the email
    // Wrapped in try/catch — discount validation must never crash checkout
    startDiscountTransition(async () => {
      try {
        const result = await validateCheckoutDiscounts({
          referralCode: referralCode,
          email: email,
        });
        setReferralDiscount(result.referralDiscount);
        setReferralError(result.referralError);
        setStoreCredit(result.storeCredit);
        if (result.referralCode) {
          setReferralCode(result.referralCode);
        }
        discountFetchedForRef.current = referralCode;
      } catch (e) {
        console.error("[Checkout] Discount validation failed:", e);
        // Gracefully skip — checkout proceeds without discounts
      }
    });
  }, [referralCode]);

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
        <div className="mb-6 flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary self-start">
            <Lock className="size-3" />
            Bezpečná objednávka
          </span>
          <h1 className="font-heading text-3xl font-bold text-foreground">Objednávka</h1>
        </div>
        <p className="mt-4 text-muted-foreground">Načítání...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-brand/10 to-blush/30">
          <ShoppingBag className="size-7 text-brand" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Košík je prázdný
        </h1>
        <p className="mt-2 text-muted-foreground">
          Nejdříve si přidejte něco do košíku.
        </p>
        <Button size="lg" className="mt-6" render={<Link href="/products" />}>
          Prohlédnout produkty
        </Button>
      </div>
    );
  }

  // Inline card payment flow — order created, pending payment via ComgatePaymentSection
  if (state.pendingPayment) {
    const { orderNumber, accessToken } = state.pendingPayment;
    return (
      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-champagne-dark/30 bg-champagne-light/40 px-3 py-1 text-xs font-semibold tracking-wide text-charcoal self-start">
            <CreditCard className="size-3" />
            Dokončení platby
          </span>
          <h1 className="font-heading text-2xl font-bold text-foreground">Platba</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Objednávka <strong>{orderNumber}</strong> vytvořena — dokončete platbu
        </p>
        <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          <ComgatePaymentSection
            orderNumber={orderNumber}
            accessToken={accessToken}
            total={totalPrice()}
            onSuccess={clearCart}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/cart"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zpět do košíku
      </Link>

      <div className="mb-6 flex flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary self-start">
          <Lock className="size-3" />
          Bezpečná objednávka
        </span>
        <h1 className="font-heading text-3xl font-bold text-foreground">Objednávka</h1>
      </div>

      {state.error && (
        <div
          role="alert"
          className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      {/* Express checkout buttons — above accordion, C1496: 2x mobile conversion */}
      <div className="mt-6">
        <ExpressCheckoutButtons
          onSelect={() => setPaymentMethod("card")}
        />
      </div>

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
        {referralCode && referralDiscount > 0 && (
          <input type="hidden" name="referralCode" value={referralCode} />
        )}
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

        {/* Referral banner */}
        {referralCode && !referralError && referralDiscount > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-sage/30 bg-sage-light px-4 py-3 text-sm text-sage-dark">
            <Gift className="size-4 shrink-0" />
            <span>
              Kód doporučení <strong>{referralCode}</strong> — sleva{" "}
              {formatPrice(referralDiscount)} na objednávku
            </span>
          </div>
        )}
        {referralError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-champagne-dark/40 bg-champagne-light px-4 py-3 text-sm text-charcoal">
            <Tag className="size-4 shrink-0" />
            <span>{referralError}</span>
          </div>
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
                  className="mt-0.5 size-5 shrink-0 rounded border-gray-300 text-primary accent-primary"
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
                size="lg"
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
                <div className="mb-4 rounded-lg bg-sage-light px-3 py-2 text-sm text-sage-dark">
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
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-colors duration-150 ${
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
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                            isSelected
                              ? "border-primary"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isSelected && (
                            <div className="size-3 rounded-full bg-primary" />
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
                            <span className="text-sage-dark">Zdarma</span>
                          ) : (
                            formatPrice(option.price)
                          )}
                        </span>
                      </label>

                      {/* Packeta widget */}
                      {option.id === "packeta_pickup" && isSelected && (
                        <div className="mt-3">
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
                      <AddressAutocomplete
                        inputRef={streetRef}
                        id="street"
                        name="street"
                        required
                        placeholder="Začněte psát adresu..."
                        autoComplete="street-address"
                        aria-invalid={!!state.fieldErrors.street}
                        aria-describedby={
                          state.fieldErrors.street ? "street-error" : undefined
                        }
                        onSelect={handleAddressSelect}
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
                size="lg"
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
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-colors duration-150 ${
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
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                          isSelected
                            ? "border-primary"
                            : "border-muted-foreground/40"
                        }`}
                      >
                        {isSelected && (
                          <div className="size-3 rounded-full bg-primary" />
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

              {/* Inline trust badges — 2-3 max, inline with form (C1496: 40-60% better than footer) */}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="flex items-center gap-2 rounded-lg border border-sage/25 bg-sage-light/60 px-3 py-2.5 text-xs text-sage-dark">
                  <Lock className="size-3.5 shrink-0" />
                  <span className="font-medium">Šifrované spojení</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-sage/25 bg-sage-light/60 px-3 py-2.5 text-xs text-sage-dark">
                  <ShieldCheck className="size-3.5 shrink-0" />
                  <span className="font-medium">Comgate — platební brána</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-sage/25 bg-sage-light/60 px-3 py-2.5 text-xs text-sage-dark">
                  <RotateCcw className="size-3.5 shrink-0" />
                  <span className="font-medium">14 dní na vrácení</span>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
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
                    <span className="text-sage-dark">Zdarma</span>
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
                {referralDiscount > 0 && (
                  <div className="flex justify-between text-sm text-sage-dark">
                    <span>Sleva z doporučení</span>
                    <span>-{formatPrice(referralDiscount)}</span>
                  </div>
                )}
                {effectiveStoreCredit > 0 && (
                  <div className="flex justify-between text-sm text-sage-dark">
                    <span>Kredit z doporučení</span>
                    <span>-{formatPrice(effectiveStoreCredit)}</span>
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
                    : paymentMethod === "card"
                      ? "Zaplatit kartou"
                      : "Přejít k platbě"}
              </Button>

              <p className="mt-2 text-center text-xs text-muted-foreground">
                {isCod
                  ? `Zaplatíte ${formatPrice(total)} při převzetí zásilky`
                  : paymentMethod === "card"
                    ? "Platba proběhne přímo zde — bezpečně a šifrovaně"
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
                    <span className="text-sage-dark">Zdarma</span>
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
                {referralDiscount > 0 && (
                  <div className="mt-1 flex justify-between text-sm text-sage-dark">
                    <span>Sleva z doporučení</span>
                    <span>-{formatPrice(referralDiscount)}</span>
                  </div>
                )}
                {effectiveStoreCredit > 0 && (
                  <div className="mt-1 flex justify-between text-sm text-sage-dark">
                    <span>Kredit z doporučení</span>
                    <span>-{formatPrice(effectiveStoreCredit)}</span>
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
