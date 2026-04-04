"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSubscribersCsv } from "./actions";

export function ExportCsvButton() {
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      const csv = await getSubscribersCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={isPending}>
      <Download className="size-4" data-icon="inline-start" />
      {isPending ? "Exportuji..." : "Export CSV"}
    </Button>
  );
}
