"use client";

import { useState, useTransition, useRef } from "react";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomerNote } from "./actions";

export function CustomerInternalNoteEditor({
  customerId,
  initialValue,
}: {
  customerId: string;
  initialValue: string | null;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [saved, setSaved] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastSavedRef = useRef(initialValue ?? "");

  function handleBlur() {
    const trimmed = value.trim();
    if (trimmed === lastSavedRef.current.trim()) {
      return;
    }
    setError(null);
    setSaved("saving");
    startTransition(async () => {
      try {
        await updateCustomerNote(customerId, trimmed);
        lastSavedRef.current = trimmed;
        setSaved("saved");
        setTimeout(() => setSaved("idle"), 2000);
      } catch (err) {
        setSaved("error");
        setError(err instanceof Error ? err.message : "Uložení selhalo");
      }
    });
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Interní poznámka
        </h2>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {saved === "saving" && (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Ukládám…</span>
            </>
          )}
          {saved === "saved" && (
            <>
              <Check className="size-3.5 text-emerald-600" />
              <span className="text-emerald-600">Uloženo</span>
            </>
          )}
          {saved === "error" && (
            <>
              <AlertCircle className="size-3.5 text-destructive" />
              <span className="text-destructive">Chyba</span>
            </>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Soukromá poznámka pouze pro tebe — zákaznice ji nevidí.
      </p>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        disabled={isPending && saved === "saving"}
        maxLength={2000}
        rows={4}
        placeholder="Např. „volala ohledně vrácení, preferuje Packetu"
        className="mt-3 resize-y"
      />
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
