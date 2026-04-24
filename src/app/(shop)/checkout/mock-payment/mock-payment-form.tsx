"use client";

import { useState } from "react";
import { Loader2, CreditCard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SUCCESS_CARD = "4111 1111 1111 1111";
const DECLINE_CARD = "4000 0000 0000 0002";

interface Props {
  orderNumber: string;
  transId: string;
  token: string;
}

export function MockPaymentForm({ orderNumber, transId, token }: Props) {
  const [cardNumber, setCardNumber] = useState(SUCCESS_CARD);
  const [phase, setPhase] = useState<"idle" | "pending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function normalize(card: string): string {
    return card.replace(/\s+/g, "");
  }

  async function submit(outcome: "success" | "decline") {
    setPhase("pending");
    setError(null);

    const normalized = normalize(cardNumber);
    // Card-number → outcome mapping only applies when user clicks "Pay".
    // Explicit Decline button forces decline regardless of card.
    let resolved: "paid" | "declined" = outcome === "decline" ? "declined" : "paid";
    if (outcome === "success") {
      if (normalized === normalize(DECLINE_CARD)) resolved = "declined";
      else if (normalized === normalize(SUCCESS_CARD)) resolved = "paid";
      else {
        // "pending then success after 3s" — simulate bank processing delay
        await new Promise((r) => setTimeout(r, 3000));
        resolved = "paid";
      }
    }

    try {
      const res = await fetch("/api/payments/mock/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber,
          transId,
          token,
          outcome: resolved,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Mock platba selhala");
      }

      // Redirect to payment-return which resolves order state + confirmation
      window.location.href = `/checkout/payment-return?refId=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(token)}`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Neznámá chyba";
      setError(msg);
      setPhase("error");
    }
  }

  if (phase === "pending") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="font-medium">Zpracovávám platbu…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Testovací karty:</p>
        <ul className="mt-1 space-y-0.5">
          <li>
            <code className="font-mono">{SUCCESS_CARD}</code> — úspěch
          </li>
          <li>
            <code className="font-mono">{DECLINE_CARD}</code> — zamítnutí
          </li>
          <li>Jiné číslo → pending, pak úspěch za 3s</li>
        </ul>
      </div>

      <div className="space-y-2">
        <Label htmlFor="mock-card">Číslo karty</Label>
        <Input
          id="mock-card"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          autoComplete="off"
          inputMode="numeric"
        />
      </div>

      {phase === "error" && error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="flex-1 gap-2"
          onClick={() => submit("success")}
        >
          <CreditCard className="size-4" />
          Zaplatit
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="flex-1"
          onClick={() => submit("decline")}
        >
          Zamítnout
        </Button>
      </div>
    </div>
  );
}
