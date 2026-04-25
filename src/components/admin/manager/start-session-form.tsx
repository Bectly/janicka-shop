"use client";

import { useState, useTransition } from "react";
import { Loader2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { startSessionAction } from "@/app/(admin)/admin/manager/actions";

export function StartSessionForm({ disabled = false }: { disabled?: boolean }) {
  const [opening, setOpening] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleStart() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await startSessionAction(opening.trim() || undefined);
        setSuccess(
          `Manažerka spuštěna — session #${result.sessionId} (${result.workerName})`,
        );
        setOpening("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Nepodařilo se spustit session",
        );
      }
    });
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={opening}
        onChange={(e) => setOpening(e.target.value)}
        placeholder='Volitelné — co chceš od ní řešit? (např. „podívej se na newslettery a navrhni co odeslat tento týden“)'
        rows={3}
        disabled={disabled || pending}
        className="resize-none"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleStart}
          disabled={disabled || pending}
          className="gap-2"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Startuju…
            </>
          ) : (
            <>
              <Play className="size-4" />
              Otevřít manažerku
            </>
          )}
        </Button>
        {disabled ? (
          <p className="text-sm text-muted-foreground">
            Manažerka už běží — sleduj progress v JARVIS app.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Spustí se na pozadí, výstupy uvidíš tady i v JARVIS app.
          </p>
        )}
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {success}
        </p>
      ) : null}
    </div>
  );
}
