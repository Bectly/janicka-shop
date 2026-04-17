"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanknoteArrowDown, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refundViaComgate } from "../actions";
import { formatPrice, formatDate } from "@/lib/format";

interface RefundButtonProps {
  returnId: string;
  returnStatus: string;
  refundAmount: number;
  paymentMethod: string | null;
  refundedAt: Date | null;
  refundProcessedAmount: number | null;
}

export function RefundButton({
  returnId,
  returnStatus,
  refundAmount,
  paymentMethod,
  refundedAt,
  refundProcessedAmount,
}: RefundButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const alreadyRefunded = Boolean(refundedAt);
  const isBankTransfer = paymentMethod === "bank_transfer";
  const isRejected = returnStatus === "rejected";
  const canRefund = !alreadyRefunded && !isRejected && !isBankTransfer;

  function handleRefund() {
    if (!confirm(`Opravdu vrátit ${formatPrice(refundAmount)} přes Comgate? Tato akce nelze vrátit zpět.`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await refundViaComgate(returnId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba při vracení peněz");
      }
    });
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h2 className="font-heading text-base font-semibold text-foreground">
        Vrácení peněz
      </h2>

      {alreadyRefunded ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span className="font-medium text-foreground">
              {formatPrice(refundProcessedAmount ?? refundAmount)} vráceno
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Provedeno {formatDate(refundedAt!)} přes Comgate
          </p>
        </div>
      ) : isBankTransfer ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Platba proběhla bankovním převodem — peníze vraťte ručně ze svého účtu.
        </p>
      ) : isRejected ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Vratka zamítnuta — peníze se nevrací.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            K vrácení: <span className="font-medium text-foreground">{formatPrice(refundAmount)}</span>
          </p>
          <Button
            onClick={handleRefund}
            disabled={!canRefund || isPending}
            className="w-full"
          >
            {isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <BanknoteArrowDown className="mr-1.5 size-4" />
            )}
            Vrátit peníze přes Comgate
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
