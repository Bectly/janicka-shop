"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportOrdersCsv } from "@/app/(admin)/admin/orders/actions";
import { useSearchParams } from "next/navigation";

export function OrderExportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? undefined;

  async function handleExport() {
    setIsExporting(true);
    try {
      const csv = await exportOrdersCsv(statusFilter);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const date = new Date().toISOString().slice(0, 10);
      link.download = `objednavky-${date}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // Server action error — silently handled
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
    >
      <Download className="mr-1.5 size-4" />
      {isExporting ? "Exportuji..." : "Exportovat CSV"}
    </Button>
  );
}
