"use client";

import { useTransition } from "react";
import { updateOrderStatus } from "../actions";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

/** Allowed status transitions — must match server-side STATUS_TRANSITIONS */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "paid", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: ["pending"],
};

export function OrderStatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const allowedNext = STATUS_TRANSITIONS[currentStatus] ?? [];

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;
    startTransition(async () => {
      await updateOrderStatus(orderId, newStatus);
    });
  }

  if (allowedNext.length === 0) {
    return (
      <span className="rounded-lg border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
        {ORDER_STATUS_LABELS[currentStatus] ?? currentStatus}
      </span>
    );
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-lg border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
    >
      <option value={currentStatus}>
        {ORDER_STATUS_LABELS[currentStatus] ?? currentStatus}
      </option>
      {allowedNext.map((status) => (
        <option key={status} value={status}>
          {ORDER_STATUS_LABELS[status] ?? status}
        </option>
      ))}
    </select>
  );
}
