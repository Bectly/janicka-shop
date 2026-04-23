"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { updateProductMeasurementsQuick } from "@/app/(admin)/admin/products/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type MeasurementKey = "chest" | "waist" | "hips" | "length" | "sleeve" | "inseam" | "shoulders";

const FIELDS: { key: MeasurementKey; label: string }[] = [
  { key: "chest", label: "Prsa" },
  { key: "waist", label: "Pas" },
  { key: "hips", label: "Boky" },
  { key: "length", label: "Délka" },
  { key: "sleeve", label: "Rukáv" },
  { key: "inseam", label: "Vnitř. nohavice" },
  { key: "shoulders", label: "Ramena" },
];

export type InitialMeasurements = Partial<Record<MeasurementKey, number>>;

export function MeasurementQuickEdit({
  id,
  initial,
  initialFitNote,
}: {
  id: string;
  initial: InitialMeasurements;
  initialFitNote: string | null;
}) {
  const [values, setValues] = useState<Record<MeasurementKey, string>>(() => ({
    chest: initial.chest != null ? String(initial.chest) : "",
    waist: initial.waist != null ? String(initial.waist) : "",
    hips: initial.hips != null ? String(initial.hips) : "",
    length: initial.length != null ? String(initial.length) : "",
    sleeve: initial.sleeve != null ? String(initial.sleeve) : "",
    inseam: initial.inseam != null ? String(initial.inseam) : "",
    shoulders: initial.shoulders != null ? String(initial.shoulders) : "",
  }));
  const [fitNote, setFitNote] = useState(initialFitNote ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function save() {
    setError(null);

    const patch: Record<string, number | string | null> = {};
    for (const { key } of FIELDS) {
      const raw = values[key].trim().replace(",", ".");
      if (raw === "") {
        patch[key] = null;
      } else {
        const n = parseFloat(raw);
        if (!isFinite(n) || n <= 0) {
          setError(`${key}: neplatná hodnota`);
          return;
        }
        patch[key] = n;
      }
    }
    const trimmedNote = fitNote.trim();
    patch.fitNote = trimmedNote ? trimmedNote.slice(0, 120) : null;

    startTransition(async () => {
      try {
        await updateProductMeasurementsQuick(
          id,
          patch as Parameters<typeof updateProductMeasurementsQuick>[1],
        );
        setSavedAt(Date.now());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Chyba při ukládání");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-muted/30 p-2">
      <div className="flex flex-wrap items-end gap-2">
        {FIELDS.map(({ key, label }) => (
          <label
            key={key}
            className="flex min-w-[64px] flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label}
            <Input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              value={values[key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
              placeholder="—"
              disabled={isPending}
              className="h-8 w-20 text-sm"
              aria-label={`${label} v cm`}
            />
          </label>
        ))}
        <label className="flex min-w-[160px] flex-1 flex-col gap-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Poznámka k střihu
          <Input
            type="text"
            value={fitNote}
            onChange={(e) => setFitNote(e.target.value.slice(0, 120))}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            maxLength={120}
            placeholder="Např. volný střih"
            disabled={isPending}
            className="h-8 text-sm"
          />
        </label>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={isPending}
          className="h-8 gap-1"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
          Uložit
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {!error && savedAt && (
        <p className="text-xs text-muted-foreground">Uloženo ✓</p>
      )}
    </div>
  );
}
