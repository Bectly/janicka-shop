"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { exportAccountingCsv } from "@/app/(admin)/admin/orders/actions";

const MONTHS = [
  "Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
  "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
];

export function AccountingExportButton() {
  const now = new Date();
  // Default to previous month (typical accounting workflow)
  const defaultDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(defaultDate.getFullYear());
  const [month, setMonth] = useState(defaultDate.getMonth() + 1);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years: number[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) years.push(y);

  async function handleExport() {
    setError(null);
    setIsExporting(true);
    try {
      const csv = await exportAccountingCsv(year, month);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ucetni-${year}-${String(month).padStart(2, "0")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chyba při exportu");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <FileSpreadsheet className="mr-1.5 size-4" />
        Export pro účetní
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export pro účetní</DialogTitle>
          <DialogDescription>
            CSV s fakturovanými objednávkami a dobropisy za vybraný měsíc (včetně základu, DPH, způsobu platby).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="accounting-month">Měsíc</Label>
            <select
              id="accounting-month"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              {MONTHS.map((name, i) => (
                <option key={i + 1} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accounting-year">Rok</Label>
            <select
              id="accounting-year"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isExporting}
          >
            Zrušit
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-1.5 size-4" />
            )}
            Stáhnout CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
