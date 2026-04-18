"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format";
import { Loader2 } from "lucide-react";
import { bulkUpdatePrice } from "@/app/(admin)/admin/products/actions";
import {
  computeBulkPrice,
  type BulkPriceMode,
} from "@/app/(admin)/admin/products/bulk-price";

interface ProductLite {
  id: string;
  name: string;
  price: number;
}

interface BulkPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: ProductLite[];
  onSuccess: (affected: number) => void;
  onError: (message: string) => void;
}

const MODE_OPTIONS: { value: BulkPriceMode; label: string; hint: string; suffix: string }[] = [
  {
    value: "absolute",
    label: "Nastavit cenu",
    hint: "Přepíše cenu u všech vybraných produktů stejnou částkou",
    suffix: "Kč",
  },
  {
    value: "percent",
    label: "Sleva o %",
    hint: "Zlevní každý produkt o zadané procento z jeho aktuální ceny",
    suffix: "%",
  },
  {
    value: "add",
    label: "Přidat Kč",
    hint: "Připočte nebo odečte fixní částku k aktuální ceně (záporné číslo = sleva)",
    suffix: "Kč",
  },
];

export function BulkPriceDialog({
  open,
  onOpenChange,
  selectedProducts,
  onSuccess,
  onError,
}: BulkPriceDialogProps) {
  const [mode, setMode] = useState<BulkPriceMode>("percent");
  const [value, setValue] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const parsedValue = parseFloat(value);
  const valueValid = !isNaN(parsedValue) && isFinite(parsedValue);

  const preview = useMemo(() => {
    if (!valueValid) return [];
    return selectedProducts.map((p) => ({
      id: p.id,
      name: p.name,
      oldPrice: p.price,
      newPrice: computeBulkPrice(p.price, mode, parsedValue),
    }));
  }, [selectedProducts, mode, parsedValue, valueValid]);

  const changedCount = preview.filter((p) => p.oldPrice !== p.newPrice).length;

  const activeMode = MODE_OPTIONS.find((m) => m.value === mode)!;

  function handleSubmit() {
    if (!valueValid) return;
    const ids = selectedProducts.map((p) => p.id);
    startTransition(async () => {
      try {
        const result = await bulkUpdatePrice(ids, mode, parsedValue);
        onSuccess(result.affected);
        onOpenChange(false);
        setValue("");
      } catch (e: unknown) {
        onError(e instanceof Error ? e.message : "Neznámá chyba");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Hromadná změna ceny · {selectedProducts.length}{" "}
            {selectedProducts.length === 1
              ? "produkt"
              : selectedProducts.length >= 2 && selectedProducts.length <= 4
                ? "produkty"
                : "produktů"}
          </DialogTitle>
          <DialogDescription>
            Každá změna se zapíše do historie cen — 30denní nejnižší cena zůstane
            korektní (zákon o falešných slevách).
          </DialogDescription>
        </DialogHeader>

        {/* Mode picker */}
        <div className="space-y-2">
          <Label>Způsob změny</Label>
          <div className="grid grid-cols-3 gap-2">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150 active:scale-95 ${
                  mode === opt.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/40"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{activeMode.hint}</p>
        </div>

        {/* Value input */}
        <div className="space-y-2">
          <Label htmlFor="bulk-price-value">
            Hodnota ({activeMode.suffix})
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="bulk-price-value"
              type="number"
              step={mode === "percent" ? 1 : 10}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                mode === "absolute"
                  ? "např. 490"
                  : mode === "percent"
                    ? "např. 20"
                    : "např. -100"
              }
              autoFocus
            />
            <span className="text-sm text-muted-foreground">
              {activeMode.suffix}
            </span>
          </div>
        </div>

        {/* Preview table */}
        {valueValid && preview.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Produkt
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Před
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Po
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Rozdíl
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => {
                  const diff = row.newPrice - row.oldPrice;
                  const unchanged = diff === 0;
                  return (
                    <tr
                      key={row.id}
                      className={`border-t ${unchanged ? "text-muted-foreground" : ""}`}
                    >
                      <td className="truncate px-3 py-2 max-w-[14rem]">
                        {row.name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatPrice(row.oldPrice)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatPrice(row.newPrice)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          diff < 0
                            ? "text-emerald-700"
                            : diff > 0
                              ? "text-destructive"
                              : ""
                        }`}
                      >
                        {unchanged
                          ? "—"
                          : `${diff > 0 ? "+" : ""}${formatPrice(diff)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {valueValid && changedCount < preview.length && (
          <p className="text-xs text-amber-700">
            {preview.length - changedCount} produkt(ů) zůstane beze změny (stejná
            cena).
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Zrušit
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!valueValid || isPending || changedCount === 0}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {isPending
              ? "Ukládám..."
              : changedCount === 0
                ? "Nic ke změně"
                : `Změnit cenu u ${changedCount} ${changedCount === 1 ? "produktu" : changedCount >= 2 && changedCount <= 4 ? "produktů" : "produktů"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
