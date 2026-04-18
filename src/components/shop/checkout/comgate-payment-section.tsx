"use client";

/**
 * ComgatePaymentSection
 *
 * Handles inline card payment (iframe) and Apple Pay / Google Pay (SDK buttons)
 * after the order has been created by the server action.
 *
 * Usage:
 *   <ComgatePaymentSection
 *     orderNumber="JN-260409-ABC123"
 *     accessToken="uuid"
 *     onSuccess={() => { clearCart(); }}
 *   />
 *
 * The component:
 * 1. Calls POST /api/payments/comgate/create to get transactionId + redirect URL
 * 2. For CARD: renders an inline 504×679px iframe
 * 3. For Apple Pay / Google Pay: mounts SDK buttons (if device supports them)
 * 4. On payment completion: redirects to /order/[number]?token=...
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, AlertCircle, Lock, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isComgateCheckoutConfigured,
  initComgateApplePay,
  initComgateGooglePay,
} from "@/lib/payments/comgate-sdk";

interface Props {
  orderNumber: string;
  accessToken: string;
  total: number;
  onSuccess?: () => void;
}

type Phase =
  | "init"        // loading transId from server
  | "express"     // showing Apple/Google Pay buttons
  | "card"        // showing inline iframe
  | "waiting"     // payment submitted, awaiting webhook
  | "error";      // unrecoverable error

interface PaymentData {
  transactionId: string;
  redirect: string;
}

const IS_TEST = process.env.NEXT_PUBLIC_COMGATE_TEST === "true";

export function ComgatePaymentSection({ orderNumber, accessToken, onSuccess }: Props) {
  const [phase, setPhase] = useState<Phase>("init");
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [hasApplePay, setHasApplePay] = useState(false);
  const [hasGooglePay, setHasGooglePay] = useState(false);

  const applePayRef = useRef<HTMLDivElement>(null);
  const googlePayRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const orderUrl = `/order/${orderNumber}?token=${accessToken}`;

  const handlePaymentSuccess = useCallback(() => {
    setPhase("waiting");
    onSuccess?.();
    // Redirect to order page — webhook will have updated status
    window.location.href = orderUrl;
  }, [orderUrl, onSuccess]);

  const handlePaymentCancelled = useCallback(() => {
    setError("Platba byla zrušena. Můžete to zkusit znovu nebo zvolit jiný způsob platby.");
    setPhase("error");
  }, []);

  const handlePaymentError = useCallback((err: unknown) => {
    console.error("[ComgatePaymentSection] Payment error:", err);
    setError("Při platbě nastala chyba. Zkuste to prosím znovu.");
    setPhase("error");
  }, []);

  // Fetch transactionId from server and set up payment
  const initPayment = useCallback(async (method: "CARD" | "APPLE_PAY" | "GOOGLE_PAY") => {
    setPhase("init");
    setError(null);

    try {
      const res = await fetch("/api/payments/comgate/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, method, accessToken }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Nepodařilo se vytvořit platbu");
      }

      const data: PaymentData = await res.json();
      setPaymentData(data);

      if (method === "CARD") {
        setPhase("card");
      } else if (method === "APPLE_PAY" && applePayRef.current) {
        const callbacks = {
          onPaid: handlePaymentSuccess,
          onCancelled: handlePaymentCancelled,
          onError: handlePaymentError,
        };
        await initComgateApplePay(data.transactionId, {
          mountElement: applePayRef.current,
          callbacks,
        });
      } else if (method === "GOOGLE_PAY" && googlePayRef.current) {
        const callbacks = {
          onPaid: handlePaymentSuccess,
          onCancelled: handlePaymentCancelled,
          onError: handlePaymentError,
        };
        await initComgateGooglePay(data.transactionId, {
          mountElement: googlePayRef.current,
          callbacks,
        });
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Nepodařilo se inicializovat platbu";
      setError(msg);
      setPhase("error");
    }
  }, [orderNumber, handlePaymentSuccess, handlePaymentCancelled, handlePaymentError]);

  // On mount: fetch transactionId for card, also try to init Apple/Google Pay
  useEffect(() => {
    let cancelled = false;

    async function setup() {
      // First get transactionId (needed for SDK init)
      try {
        const res = await fetch("/api/payments/comgate/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNumber, method: "CARD", accessToken }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Nepodařilo se vytvořit platbu");
        }

        const data: PaymentData = await res.json();
        if (cancelled) return;

        setPaymentData(data);
        setPhase("express");

        // Try Apple Pay / Google Pay if SDK is configured
        if (isComgateCheckoutConfigured()) {
          const callbacks = {
            onPaid: handlePaymentSuccess,
            onCancelled: handlePaymentCancelled,
            onError: handlePaymentError,
          };

          // Run both in parallel — neither blocks the other
          if (applePayRef.current) {
            initComgateApplePay(data.transactionId, {
              mountElement: applePayRef.current,
              callbacks,
            }).then((can) => {
              if (!cancelled) setHasApplePay(can);
            }).catch(() => {});
          }

          if (googlePayRef.current) {
            initComgateGooglePay(data.transactionId, {
              mountElement: googlePayRef.current,
              callbacks,
            }).then((can) => {
              if (!cancelled) setHasGooglePay(can);
            }).catch(() => {});
          }
        }
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error ? e.message : "Nepodařilo se inicializovat platbu";
          setError(msg);
          setPhase("error");
        }
      }
    }

    setup();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (phase === "waiting") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="font-medium">Zpracovávám platbu…</p>
        <p className="text-sm text-muted-foreground">
          Přesměrovávám na potvrzení objednávky
        </p>
      </div>
    );
  }

  if (phase === "init") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Připravuji platbu…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sandbox mode badge */}
      {IS_TEST && (
        <div className="rounded-lg border border-champagne bg-champagne-light px-3 py-2 text-xs text-champagne-dark">
          <strong>Sandbox režim</strong> — platba je testovací, žádné peníze nebudou strženy
        </div>
      )}

      {/* Error state */}
      {phase === "error" && error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Platba se nezdařila</p>
            <p className="mt-0.5 text-xs">{error}</p>
          </div>
        </div>
      )}

      {/* Card inline iframe */}
      {phase === "card" && paymentData && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="size-4" />
            Platba kartou
          </div>
          {/* Comgate inline iframe — scales down from 504×679px on mobile */}
          <div className="mx-auto w-full max-w-[504px] overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="relative w-full aspect-[504/679]">
              <iframe
                ref={iframeRef}
                id="comgate-iframe"
                src={paymentData.redirect}
                allow="payment"
                frameBorder="0"
                className="absolute inset-0 h-full w-full"
                title="Comgate platební brána"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPhase("express")}
            className="min-h-11 px-2 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            ← Zpět na výběr platby
          </button>
        </div>
      )}

      {/* Express + card selection */}
      {(phase === "express" || phase === "error") && (
        <div className="space-y-3">
          {/* Apple Pay */}
          <div
            ref={applePayRef}
            className={hasApplePay ? "block" : "hidden"}
            aria-label="Apple Pay"
          />

          {/* Google Pay */}
          <div
            ref={googlePayRef}
            className={hasGooglePay ? "block" : "hidden"}
            aria-label="Google Pay"
          />

          {/* Divider between express and card (only when express methods available) */}
          {(hasApplePay || hasGooglePay) && (
            <div className="relative flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">nebo</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          {/* Card payment button */}
          <Button
            type="button"
            size="lg"
            className="w-full gap-2"
            onClick={() => {
              if (paymentData) {
                setPhase("card");
              } else {
                initPayment("CARD");
              }
            }}
          >
            <CreditCard className="size-4" />
            Zaplatit kartou
          </Button>
        </div>
      )}

      {/* Inline trust badge */}
      <div className="flex items-center gap-2 rounded-lg border border-sage bg-sage-light px-3 py-2 text-xs text-sage-dark">
        <Lock className="size-3.5 shrink-0" />
        <span>Zabezpečená platba — šifrováno pomocí SSL</span>
      </div>

      {/* Order link */}
      <p className="text-center text-xs text-muted-foreground">
        Číslo objednávky: <strong>{orderNumber}</strong>
        {" · "}
        <a
          href={orderUrl}
          className="underline underline-offset-2 transition-colors duration-150 hover:text-foreground"
        >
          Zobrazit objednávku
        </a>
      </p>
    </div>
  );
}
