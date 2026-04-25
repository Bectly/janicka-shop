"use client";

import { useState, useTransition } from "react";
import { Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { requestSessionAction } from "@/app/(admin)/admin/manager/actions";

export function StartSessionForm({
  disabled = false,
  disabledReason,
}: {
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [opening, setOpening] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await requestSessionAction(opening || undefined);
      if (!r.ok) {
        setError(r.error ?? "Něco se nepovedlo");
      } else {
        setOpening("");
        setSuccess(
          "✅ Session requested. Manažerka se rozjede do ~30s, výstupy se objeví níže.",
        );
      }
    });
  };

  return (
    <div className="space-y-3">
      <textarea
        rows={3}
        value={opening}
        onChange={(e) => setOpening(e.target.value.slice(0, 1000))}
        placeholder="Volitelně: napiš co manažerka má řešit (např. 'Podívej se na newslettery, navrhni co dál'). Nech prázdné pro general orientation."
        disabled={isPending || disabled}
        className="w-full resize-none rounded-md border bg-background p-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {opening.length}/1000 znaků
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || disabled}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          title={disabled ? disabledReason : undefined}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Requesting…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Spustit manažerku
            </>
          )}
        </button>
      </div>
      {disabled && disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-2 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-700">
          {success}
        </div>
      )}
    </div>
  );
}
