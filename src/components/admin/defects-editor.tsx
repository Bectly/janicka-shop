"use client";

import { useState } from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFECT_LABELS,
  DEFECT_TYPES,
  type DefectType,
  type DefectSeverity,
  type ProductDefect,
} from "@/lib/defects";

interface DefectsEditorProps {
  initial?: ProductDefect[];
  name?: string;
}

export function DefectsEditor({ initial = [], name = "defects" }: DefectsEditorProps) {
  const [defects, setDefects] = useState<ProductDefect[]>(initial);

  function addDefect() {
    setDefects((prev) => [
      ...prev,
      { type: "stain", severity: "minor", description: "" },
    ]);
  }

  function removeDefect(index: number) {
    setDefects((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDefect(index: number, patch: Partial<ProductDefect>) {
    setDefects((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  }

  const serialized = JSON.stringify(
    defects.map((d) => ({
      type: d.type,
      severity: d.severity,
      ...(d.description?.trim() ? { description: d.description.trim() } : {}),
    })),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="size-4 text-muted-foreground" />
        <Label>Vady a nedokonalosti</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Zákaznice vidí přesný popis — buduje to důvěru. Žádná nepříjemná překvapení.
      </p>

      <input type="hidden" name={name} value={serialized} />

      {defects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Žádné vady — kousek je bez viditelných nedokonalostí.
        </div>
      ) : (
        <div className="space-y-2">
          {defects.map((d, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-center"
            >
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Typ</Label>
                <select
                  value={d.type}
                  onChange={(e) =>
                    updateDefect(i, { type: e.target.value as DefectType })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {DEFECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {DEFECT_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Závažnost</Label>
                <select
                  value={d.severity}
                  onChange={(e) =>
                    updateDefect(i, {
                      severity: e.target.value as DefectSeverity,
                    })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="minor">Drobná</option>
                  <option value="moderate">Střední</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Popis {d.type === "other" && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  value={d.description ?? ""}
                  maxLength={300}
                  onChange={(e) =>
                    updateDefect(i, { description: e.target.value })
                  }
                  placeholder={
                    d.type === "other"
                      ? "Popište vadu…"
                      : "např. malá skvrna na pravém rukávu"
                  }
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDefect(i)}
                  aria-label="Odstranit vadu"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addDefect}
        disabled={defects.length >= 20}
      >
        <Plus className="size-4" />
        Přidat vadu
      </Button>
    </div>
  );
}
