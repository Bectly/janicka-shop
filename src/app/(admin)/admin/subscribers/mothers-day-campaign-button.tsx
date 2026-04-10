"use client";

import { useState, useTransition } from "react";
import { Heart, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { sendMothersDayCampaign } from "./actions";
import type { MothersDayEmailNumber } from "@/lib/email";

interface Props {
  activeSubscriberCount: number;
}

const EMAIL_OPTIONS: {
  value: MothersDayEmailNumber;
  label: string;
  date: string;
  description: string;
}[] = [
  {
    value: 1,
    label: "Warmup",
    date: "1. května",
    description:
      "Představení kampaně, persona grid (Minimalistka/Klasička/Boho), produkty. Warm/cold segmentace.",
  },
  {
    value: 2,
    label: "Push",
    date: "7. května",
    description:
      "6 produktů se scarcity badge, urgence 3 dny do Dne matek.",
  },
  {
    value: 3,
    label: "Urgency",
    date: "9. května",
    description:
      "3 hero produkty, doprava zdarma nad 1 500 Kč, poslední šance objednat.",
  },
];

export function MothersDayCampaignButton({ activeSubscriberCount }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [selected, setSelected] = useState<MothersDayEmailNumber>(1);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function handleSend() {
    setResult(null);
    startTransition(async () => {
      const res = await sendMothersDayCampaign(selected);
      if (res.success) {
        setResult({
          type: "success",
          message: `Den matek email #${selected} odeslán ${res.sentCount} odběratelům${res.failedCount > 0 ? `, ${res.failedCount} selhalo` : ""}.`,
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
          className="inline-flex items-center gap-2 rounded-lg border border-pink-200 bg-pink-50 px-4 py-2.5 text-sm font-medium text-pink-700 shadow-sm transition-colors hover:bg-pink-100"
        >
          <Heart className="size-4" />
          Den matek kampaň
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
        <div className="rounded-xl border border-pink-200 bg-pink-50/30 p-5 shadow-sm">
          <h3 className="mb-2 text-base font-semibold text-foreground">
            Den matek 2026 — e-mailová kampaň
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            3-emailová sekvence: warmup (1.5.) → push (7.5.) → urgency (9.5.).
            Bude odesláno{" "}
            <strong className="text-foreground">{activeSubscriberCount}</strong>{" "}
            aktivním odběratelům.
          </p>

          {/* Email picker */}
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-medium text-foreground">
              Vyberte e-mail k odeslání
            </legend>
            <div className="space-y-2">
              {EMAIL_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    selected === opt.value
                      ? "border-pink-400 bg-pink-50 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="mothers-day-email"
                    value={opt.value}
                    checked={selected === opt.value}
                    onChange={() => setSelected(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">
                      #{opt.value} {opt.label}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({opt.date})
                    </span>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {opt.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSend}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-pink-700 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Odesílám...
                </>
              ) : (
                <>
                  <Heart className="size-4" />
                  Odeslat email #{selected}
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
