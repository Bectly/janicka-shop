"use client";

import { useTransition } from "react";
import { updateOrderStatus } from "../actions";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

const STATUSES = [
  "pending",
  "confirmed",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
];

export function OrderStatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;
    startTransition(async () => {
      await updateOrderStatus(orderId, newStatus);
    });
  }

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-lg border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
    >
      {STATUSES.map((status) => (
        <option key={status} value={status}>
          {ORDER_STATUS_LABELS[status] ?? status}
        </option>
      ))}
    </select>
  );
}
