"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { sendVintedTcCampaign } from "./actions";

interface Props {
  activeSubscriberCount: number;
  onSent?: () => void;
}

export function VintedCampaignButton({ activeSubscriberCount }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [segment, setSegment] = useState<"warm" | "cold" | "all">("all");
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function handleSend() {
    setResult(null);
    startTransition(async () => {
      const res = await sendVintedTcCampaign(segment);
      if (res.success) {
        setResult({
          type: "success",
          message: `Vinted kampaň odeslána ${res.sentCount} odběratelům${res.failedCount > 0 ? `, ${res.failedCount} selhalo` : ""}.`,
        });
        setShowConfirm(false);
      } else {
        setResult({
          type: "error",
          message: res.error ?? "Nepodařilo se odeslat kampaň.",
        });
      }
    });
  }

  return (
    <div className="space-y-3">
      {!showConfirm && (
        <button
          type="button"
          onClick={() => {
            setShowConfirm(true);
            setResult(null);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary/10"
        >
          <ShieldAlert className="size-4" />
          Odeslat Vinted kampaň
        </button>
      )}

      {result && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            result.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {result.type === "success" ? (
            <CheckCircle className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          {result.message}
        </div>
      )}

      {showConfirm && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-5 shadow-sm">
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Vinted T&C kampaň — soukromí vs. AI
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Předdefinovaný e-mail kontrastující náš přístup k soukromí vs. Vinted AI podmínky (30.&nbsp;dubna).
            Bude odesláno{" "}
            <strong className="text-foreground">{activeSubscriberCount}</strong>{" "}
            aktivním odběratelům.
          </p>

          {/* Segment picker */}
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-medium text-foreground">
              Segment
            </legend>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  { value: "all", label: "Všichni (auto-segment)" },
                  { value: "warm", label: `Warm \u2014 \u201ETvoje fotky pat\u0159\u00ed tob\u011b. V\u017edy.\u201C` },
                  { value: "cold", label: `Cold \u2014 \u201EZat\u00edmco Vinted \u0161kol\u00ed AI...\u201C` },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    segment === opt.value
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="vinted-segment"
                    value={opt.value}
                    checked={segment === opt.value}
                    onChange={() => setSegment(opt.value)}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Auto-segment: odběratelé z posledních 90 dní dostanou Subject&nbsp;A (warm), starší Subject&nbsp;B (cold).
            </p>
          </fieldset>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Odesílám...
                </>
              ) : (
                <>
                  <ShieldAlert className="size-4" />
                  Odeslat kampaň
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
              className="rounded-lg border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
