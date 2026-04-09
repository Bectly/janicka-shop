"use client";

import { useState, useTransition } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { generateInvoice, downloadInvoice } from "../actions";

interface InvoiceSectionProps {
  orderId: string;
  existingInvoice: {
    id: string;
    number: string;
    issuedAt: Date;
    totalAmount: number;
  } | null;
}

function triggerPdfDownload(pdfBase64: string, filename: string) {
  const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function InvoiceSection({
  orderId,
  existingInvoice,
}: InvoiceSectionProps) {
  const [invoice, setInvoice] = useState(existingInvoice);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateInvoice(orderId);
        setInvoice({
          id: result.invoiceId,
          number: result.invoiceNumber,
          issuedAt: new Date(),
          totalAmount: 0,
        });
        triggerPdfDownload(
          result.pdfBase64,
          `faktura-${result.invoiceNumber}.pdf`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba při generování faktury");
      }
    });
  }

  function handleDownload() {
    if (!invoice) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await downloadInvoice(invoice.id);
        triggerPdfDownload(
          result.pdfBase64,
          `faktura-${result.invoiceNumber}.pdf`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba při stahování faktury");
      }
    });
  }

  const formattedDate = invoice
    ? new Intl.DateTimeFormat("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      }).format(new Date(invoice.issuedAt))
    : null;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-heading text-base font-semibold text-foreground">
        Faktura
      </h2>

      {invoice ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="size-4 text-emerald-600" />
            <span className="font-medium text-foreground">
              {invoice.number}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Vystavena {formattedDate}
          </p>
          <button
            onClick={handleDownload}
            disabled={isPending}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Stáhnout PDF
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Faktura dosud nebyla vystavena.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Vystavit fakturu
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
