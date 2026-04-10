"use client";

import { useState, useTransition } from "react";
import { Package, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { sendCustomsDutyCampaign } from "./actions";
import type { CustomsEmailNumber } from "@/lib/email";

interface Props {
  activeSubscriberCount: number;
}

const EMAIL_OPTIONS: {
  value: CustomsEmailNumber;
  label: string;
  date: string;
  description: string;
}[] = [
  {
    value: 1,
    label: "Soft tease",
    date: "15. června",
    description:
      "Informační email o změnách v dovozu. Srovnání zahraničí vs. Janička, produkty, odkaz na /nakupuj-cesky.",
  },
  {
    value: 2,
    label: "Final push",
    date: "28. června",
    description:
      "Urgentní email 3 dny před změnou. Konkrétní cenové srovnání, produkty, CTA na shop.",
  },
];

export function CustomsCampaignButton({ activeSubscriberCount }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [selected, setSelected] = useState<CustomsEmailNumber>(1);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function handleSend() {
    setResult(null);
    startTransition(async () => {
      const res = await sendCustomsDutyCampaign(selected);
      if (res.success) {
        setResult({
          type: "success",
          message: `EU clo email #${selected} odeslán ${res.sentCount} odběratelům${res.failedCount > 0 ? `, ${res.failedCount} selhalo` : ""}.`,
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
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100"
        >
          <Package className="size-4" />
          EU clo kampaň
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
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm">
          <h3 className="mb-2 text-base font-semibold text-foreground">
            EU clo 2026 — e-mailová kampaň
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            2-emailová sekvence: soft tease (15.6.) + final push (28.6.).
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
                      ? "border-emerald-400 bg-emerald-50 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="customs-email"
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
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Odesílám...
                </>
              ) : (
                <>
                  <Package className="size-4" />
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
