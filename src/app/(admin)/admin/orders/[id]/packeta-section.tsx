"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Package, Download, Check, AlertCircle } from "lucide-react";
import { createPacketaShipment, downloadPacketaLabel } from "../actions";

export function PacketaSection({
  orderId,
  packetId: initialPacketId,
}: {
  orderId: string;
  packetId: string | null;
}) {
  const [packetId, setPacketId] = useState(initialPacketId);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState(false);

  function handleCreate() {
    setError(null);
    setJustCreated(false);
    startTransition(async () => {
      try {
        const result = await createPacketaShipment(orderId);
        setPacketId(result.packetId);
        setJustCreated(true);
        setTimeout(() => setJustCreated(false), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nepodařilo se vytvořit zásilku");
      }
    });
  }

  function handleDownloadLabel() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await downloadPacketaLabel(orderId);
        // Decode base64 PDF and trigger download
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `packeta-${result.packetId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nepodařilo se stáhnout štítek");
      }
    });
  }

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center gap-2">
        <Package className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Packeta zásilka
        </span>
      </div>

      {packetId ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">ID zásilky: </span>
            <span className="font-mono">{packetId}</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadLabel}
            disabled={isPending}
          >
            <Download className="size-3.5" />
            {isPending ? "Stahuji..." : "Stáhnout štítek"}
          </Button>
        </div>
      ) : (
        <div className="mt-2">
          <Button
            size="sm"
            variant={justCreated ? "outline" : "default"}
            onClick={handleCreate}
            disabled={isPending || justCreated}
          >
            {justCreated ? (
              <>
                <Check className="size-3.5" />
                Zásilka vytvořena
              </>
            ) : isPending ? (
              "Vytvářím..."
            ) : (
              <>
                <Package className="size-3.5" />
                Vytvořit zásilku
              </>
            )}
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
