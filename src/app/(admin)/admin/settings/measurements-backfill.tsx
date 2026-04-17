"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Ruler, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  backfillMeasurements,
  type MeasurementsBackfillResult,
} from "./actions";

const FIELD_LABELS: Record<string, string> = {
  chest: "Hrudník",
  waist: "Pas",
  hips: "Boky",
  length: "Délka",
};

export function MeasurementsBackfill() {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<MeasurementsBackfillResult | null>(null);

  function runBackfill() {
    setConfirmOpen(false);
    setResult(null);
    startTransition(async () => {
      const r = await backfillMeasurements();
      setResult(r);
    });
  }

  return (
    <div className="space-y-4">
      {result && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            result.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-destructive/20 bg-destructive/5 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {result.success ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            {result.message}
          </div>
          {result.success && (
            <div className="mt-2 grid gap-1 text-xs text-emerald-900/80 sm:grid-cols-2">
              <div>Prohledáno: {result.totalScanned}</div>
              <div>Aktualizováno: {result.updated}</div>
              <div>Přeskočeno: {result.skipped}</div>
              <div>
                Pole:{" "}
                {(Object.keys(result.byField) as Array<keyof typeof result.byField>)
                  .map((k) => `${FIELD_LABELS[k] ?? k} ${result.byField[k]}`)
                  .join(" · ")}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
          ) : (
            <Ruler className="size-4" data-icon="inline-start" />
          )}
          {isPending ? "Zpracovávám…" : "Doplnit rozměry z popisků"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Přečte „📏 Rozměry:" z popisků produktů a uloží hrudník / pas / boky /
          délku do strukturovaných dat. Produkty, které už rozměry mají, přeskočí.
        </p>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spustit doplnění rozměrů?</DialogTitle>
            <DialogDescription>
              Projde všechny produkty, které ještě nemají rozměry, vytáhne z
              popisků čísla v cm a uloží je. Operace může trvat půl minuty až
              minutu podle počtu produktů. Existující rozměry zůstanou beze
              změny.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Zrušit
            </Button>
            <Button type="button" onClick={runBackfill}>
              Spustit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
