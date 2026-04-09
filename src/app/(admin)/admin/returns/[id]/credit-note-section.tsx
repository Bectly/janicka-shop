"use client";

import { useState, useTransition } from "react";
import { FileText, Download, Loader2 } from "lucide-react";
import { generateCreditNote, downloadCreditNote } from "../actions";

interface CreditNoteSectionProps {
  returnId: string;
  returnStatus: string;
  existingCreditNote: {
    id: string;
    number: string;
    invoiceNumber: string;
    issuedAt: Date;
    totalAmount: number;
  } | null;
  hasInvoice: boolean;
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

export function CreditNoteSection({
  returnId,
  returnStatus,
  existingCreditNote,
  hasInvoice,
}: CreditNoteSectionProps) {
  const [creditNote, setCreditNote] = useState(existingCreditNote);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canGenerate =
    !creditNote &&
    hasInvoice &&
    (returnStatus === "approved" || returnStatus === "completed");

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await generateCreditNote(returnId);
        setCreditNote({
          id: result.creditNoteId,
          number: result.creditNoteNumber,
          invoiceNumber: "",
          issuedAt: new Date(),
          totalAmount: 0,
        });
        triggerPdfDownload(
          result.pdfBase64,
          `dobropis-${result.creditNoteNumber}.pdf`,
        );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Chyba při generování dobropisu",
        );
      }
    });
  }

  function handleDownload() {
    if (!creditNote) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await downloadCreditNote(creditNote.id);
        triggerPdfDownload(
          result.pdfBase64,
          `dobropis-${result.creditNoteNumber}.pdf`,
        );
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Chyba při stahování dobropisu",
        );
      }
    });
  }

  const formattedDate = creditNote
    ? new Intl.DateTimeFormat("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      }).format(new Date(creditNote.issuedAt))
    : null;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-heading text-base font-semibold text-foreground">
        Dobropis
      </h2>

      {creditNote ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="size-4 text-rose-600" />
            <span className="font-medium text-foreground">
              {creditNote.number}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Vystaven {formattedDate}
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
      ) : canGenerate ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Dobropis dosud nebyl vystaven.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Vystavit dobropis
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            {!hasInvoice
              ? "Nelze vystavit — objednávka nemá fakturu."
              : "Dobropis lze vystavit po schválení nebo dokončení vratky."}
          </p>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
