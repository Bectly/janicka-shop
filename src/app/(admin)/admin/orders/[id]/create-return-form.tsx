"use client";

import { useState, useTransition } from "react";
import { createReturn } from "../../returns/actions";
import { RETURN_REASON_LABELS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  size: string | null;
  color: string | null;
}

export function CreateReturnForm({
  orderId,
  orderTotal,
  items,
}: {
  orderId: string;
  orderTotal: number;
  items: OrderItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("withdrawal_14d");
  const [reasonDetail, setReasonDetail] = useState("");
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedTotal = items
    .filter((i) => selectedItems.has(i.id))
    .reduce((sum, i) => sum + i.price, 0);

  const refundAmount =
    refundType === "full" ? selectedTotal : parseFloat(customAmount) || 0;

  function toggleItem(itemId: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function handleSubmit() {
    setError("");

    if (selectedItems.size === 0) {
      setError("Vyberte alespoň jednu položku k vrácení");
      return;
    }

    if (refundAmount <= 0) {
      setError("Částka k vrácení musí být kladná");
      return;
    }

    if (refundAmount > orderTotal) {
      setError("Částka nesmí převyšovat celkovou cenu objednávky");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createReturn({
          orderId,
          reason,
          reasonDetail: reasonDetail || undefined,
          refundAmount,
          itemIds: Array.from(selectedItems),
        });
        setSuccess(`Vratka ${result.returnNumber} vytvořena`);
        setIsOpen(false);
        setSelectedItems(new Set());
        setReasonDetail("");
        setCustomAmount("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba při vytváření vratky");
      }
    });
  }

  if (success) {
    return (
      <div className="rounded-lg bg-primary/5 px-4 py-3 text-sm text-primary">
        {success}
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
      >
        Vytvořit vratku
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-red-200 bg-red-50/50 p-4">
      <h3 className="font-heading text-sm font-semibold text-foreground">
        Nová vratka
      </h3>

      {/* Item selection */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Položky k vrácení
        </p>
        {items.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/50"
          >
            <input
              type="checkbox"
              checked={selectedItems.has(item.id)}
              onChange={() => toggleItem(item.id)}
              className="size-4 rounded border-gray-300"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{item.name}</p>
              <div className="flex gap-2 text-xs text-muted-foreground">
                {item.size && <span>Vel. {item.size}</span>}
                {item.color && <span>Barva: {item.color}</span>}
              </div>
            </div>
            <span className="text-sm font-medium">{formatPrice(item.price)}</span>
          </label>
        ))}
      </div>

      {/* Reason */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Důvod
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {Object.entries(RETURN_REASON_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Reason detail */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Podrobnosti (volitelné)
        </label>
        <textarea
          value={reasonDetail}
          onChange={(e) => setReasonDetail(e.target.value)}
          placeholder="Doplňující informace..."
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          rows={2}
        />
      </div>

      {/* Refund amount */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Částka k vrácení
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRefundType("full")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              refundType === "full"
                ? "bg-primary text-primary-foreground"
                : "border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Plná ({formatPrice(selectedTotal)})
          </button>
          <button
            type="button"
            onClick={() => setRefundType("partial")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              refundType === "partial"
                ? "bg-primary text-primary-foreground"
                : "border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            Částečná
          </button>
        </div>
        {refundType === "partial" && (
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Částka v Kč"
            min="1"
            max={orderTotal}
            step="1"
            className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isPending || selectedItems.size === 0}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "Vytvářím..." : "Vytvořit vratku"}
        </button>
        <button
          onClick={() => {
            setIsOpen(false);
            setError("");
          }}
          className="rounded-lg border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          Zrušit
        </button>
      </div>
    </div>
  );
}
