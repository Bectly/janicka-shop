"use client";

import { useState, useTransition } from "react";
import { updateNewsletterPreference } from "./actions";

interface Props {
  email: string;
}

export function PreferenceCenter({ email }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function handleAction(
    action: "resubscribe" | "new_arrivals" | "discounts" | "pause_30",
  ) {
    startTransition(async () => {
      const res = await updateNewsletterPreference(email, action);
      if (res.ok) {
        const messages: Record<string, string> = {
          resubscribe: "Znovu přihlášena! Budeme ti posílat všechny novinky.",
          new_arrivals: "Super! Budeme ti posílat jen nové kousky.",
          discounts: "Dobře! Dáme vědět jen o slevách.",
          pause_30: "Pauza na 30 dní. Po měsíci se zase ozveme.",
        };
        setResult({ type: "success", message: messages[action] ?? "Hotovo!" });
      } else {
        setResult({ type: "error", message: res.error ?? "Něco se nepovedlo." });
      }
    });
  }

  if (result) {
    return (
      <div className="mt-8 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-center gap-2">
          {result.type === "success" ? (
            <svg
              className="h-5 w-5 text-sage-dark"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg
              className="h-5 w-5 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <p className="text-sm font-medium text-foreground">{result.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-5">
      {/* Preference options */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="mb-4 text-sm font-medium text-foreground">
          Nebo si uprav, co ti chodí:
        </p>
        <div className="space-y-2">
          <button
            onClick={() => handleAction("new_arrivals")}
            disabled={isPending}
            className="w-full rounded-md border border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Jen nové kousky
          </button>
          <button
            onClick={() => handleAction("discounts")}
            disabled={isPending}
            className="w-full rounded-md border border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Jen slevy
          </button>
          <button
            onClick={() => handleAction("pause_30")}
            disabled={isPending}
            className="w-full rounded-md border border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Pauza na 30 dní
          </button>
        </div>
      </div>

      {/* Re-subscribe link */}
      <p className="text-sm text-muted-foreground">
        Změnila sis to?{" "}
        <button
          onClick={() => handleAction("resubscribe")}
          disabled={isPending}
          className="text-foreground underline underline-offset-4 transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Znovu se přihlásit
        </button>
      </p>
    </div>
  );
}
