"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, Truck, Printer, X, Loader2, CheckCircle2, ShoppingBag } from "lucide-react";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { formatPrice, formatDate } from "@/lib/format";
import { bulkMarkAsShipped, bulkDownloadPacketaLabels } from "./actions";

export interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string | null;
  shippingMethod: string | null;
  packetId: string | null;
  total: number;
  createdAt: string; // ISO
  itemCount: number;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  deadlineUrgency: "ok" | "approaching" | "urgent" | "overdue" | null;
}

// Only orders currently in "paid" state can be marked as shipped.
const SHIPPABLE_STATUS = "paid";

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const selectedOrders = useMemo(
    () => orders.filter((o) => selected.has(o.id)),
    [orders, selected],
  );

  const shippableSelected = useMemo(
    () => selectedOrders.filter((o) => o.status === SHIPPABLE_STATUS),
    [selectedOrders],
  );

  const packetaSelected = useMemo(
    () => selectedOrders.filter((o) => o.packetId),
    [selectedOrders],
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === orders.length && orders.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map((o) => o.id)));
    }
  }

  function clearSelection() {
    setSelected(new Set());
    setFeedback(null);
  }

  function handleBulkShip() {
    if (shippableSelected.length === 0) return;
    const count = shippableSelected.length;
    if (
      !confirm(
        `Označit ${count} ${
          count === 1 ? "objednávku" : count >= 2 && count <= 4 ? "objednávky" : "objednávek"
        } jako odeslané? Zákaznice dostanou e-mail s oznámením.`,
      )
    )
      return;

    setFeedback({ kind: "info", message: `Odesílám ${count}…` });
    startTransition(async () => {
      try {
        const result = await bulkMarkAsShipped(shippableSelected.map((o) => o.id));
        if (result.failed.length === 0) {
          setFeedback({
            kind: "success",
            message: `✓ Označeno jako odeslané: ${result.succeeded.length}`,
          });
        } else {
          setFeedback({
            kind: "error",
            message: `Hotovo: ${result.succeeded.length}, selhalo: ${result.failed.length} (${result.failed[0].error})`,
          });
        }
        setSelected(new Set());
      } catch (err) {
        setFeedback({
          kind: "error",
          message: err instanceof Error ? err.message : "Hromadná akce selhala",
        });
      }
    });
  }

  function handleBulkLabels() {
    if (packetaSelected.length === 0) return;

    startTransition(async () => {
      try {
        setFeedback({
          kind: "info",
          message: `Stahuji štítky (${packetaSelected.length})…`,
        });
        const result = await bulkDownloadPacketaLabels(
          packetaSelected.map((o) => o.id),
        );

        // Decode base64 → Blob → trigger download
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
        a.download = `packeta-stitky-${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (result.skipped.length > 0) {
          setFeedback({
            kind: "info",
            message: `PDF staženo (${result.packetIds.length}). Přeskočeno: ${result.skipped.length} (bez Packeta zásilky).`,
          });
        } else {
          setFeedback({
            kind: "success",
            message: `✓ PDF staženo (${result.packetIds.length} štítků)`,
          });
        }
      } catch (err) {
        setFeedback({
          kind: "error",
          message: err instanceof Error ? err.message : "Stažení štítků selhalo",
        });
      }
    });
  }

  const allSelected = orders.length > 0 && selected.size === orders.length;
  const someSelected = selected.size > 0 && selected.size < orders.length;

  return (
    <>
      {/* Bulk action bar (fixed at bottom when selection active) */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-5 py-3 shadow-lg sm:bottom-6">
          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={clearSelection}
              className="rounded-lg p-1 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-95"
              aria-label="Zrušit výběr"
            >
              <X className="size-4" />
            </button>
            <span className="font-medium text-foreground">
              Vybráno: {selected.size}
            </span>
            {shippableSelected.length !== selected.size && (
              <span className="text-xs text-muted-foreground">
                ({shippableSelected.length} lze odeslat)
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBulkShip}
              disabled={isPending || shippableSelected.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Truck className="size-3.5" />
              )}
              Označit jako odeslané ({shippableSelected.length})
            </button>
            <button
              onClick={handleBulkLabels}
              disabled={isPending || packetaSelected.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Printer className="size-3.5" />
              )}
              Vytisknout štítky Packeta ({packetaSelected.length})
            </button>
          </div>
        </div>
      )}

      {/* Feedback toast */}
      {feedback && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
            feedback.kind === "success"
              ? "border-primary/20 bg-primary/5 text-primary"
              : feedback.kind === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-muted text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-1.5">
            {feedback.kind === "success" && <CheckCircle2 className="size-4" />}
            {feedback.kind === "error" && <AlertTriangle className="size-4" />}
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    aria-label="Vybrat vše"
                    className="size-4 cursor-pointer rounded border-border"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Objednávka
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Zákazník
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Platba
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Položky
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Celkem
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Datum
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <ShoppingBag className="h-10 w-10 opacity-30" />
                      <p className="font-medium">Žádné objednávky</p>
                      <p className="text-sm">Objednávky se zde zobrazí, jakmile zákazníci nakoupí.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const isChecked = selected.has(order.id);
                  return (
                    <tr
                      key={order.id}
                      className={`border-b last:border-0 hover:bg-muted/30 ${
                        isChecked ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(order.id)}
                          aria-label={`Vybrat ${order.orderNumber}`}
                          className="size-4 cursor-pointer rounded border-border"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                          {order.deadlineUrgency === "overdue" && (
                            <span title="Po termínu doručení!">
                              <AlertTriangle className="size-3.5 text-red-500" />
                            </span>
                          )}
                          {order.deadlineUrgency === "urgent" && (
                            <span title="Termín doručení do 5 dní">
                              <Clock className="size-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {order.customerFirstName} {order.customerLastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.customerEmail}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            ORDER_STATUS_COLORS[order.status] ??
                            "bg-muted text-muted-foreground"
                          }`}
                        >
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[order.paymentMethod ?? ""] ??
                            order.paymentMethod ??
                            "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {order.itemCount}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatPrice(order.total)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(new Date(order.createdAt))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom padding when action bar is floating */}
      {selected.size > 0 && <div className="h-24" aria-hidden />}
    </>
  );
}
