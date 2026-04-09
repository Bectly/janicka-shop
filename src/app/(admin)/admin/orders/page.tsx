import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
import { formatPrice, formatDate } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { OrderSearch } from "@/components/admin/order-search";
import { OrderExportButton } from "@/components/admin/order-export-button";
import { AlertTriangle, Clock } from "lucide-react";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = {
  title: "Objednávky",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const db = await getDb();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const VALID_STATUSES = ["pending", "confirmed", "paid", "shipped", "delivered", "cancelled"];

  const where: Prisma.OrderWhereInput = {};
  if (params.status && params.status !== "all" && VALID_STATUSES.includes(params.status)) {
    where.status = params.status;
  }

  // Search by order number, customer name, or customer email
  if (query) {
    where.OR = [
      { orderNumber: { contains: query } },
      { customer: { firstName: { contains: query } } },
      { customer: { lastName: { contains: query } } },
      { customer: { email: { contains: query } } },
    ];
  }

  const orders = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      customer: {
        select: { firstName: true, lastName: true, email: true },
      },
      _count: { select: { items: true } },
    },
  });

  // Compute delivery deadline urgency for active orders
  const now = new Date();
  const ordersWithDeadline = orders.map((order) => {
    let deadlineUrgency: "ok" | "approaching" | "urgent" | "overdue" | null = null;
    if (
      order.expectedDeliveryDate &&
      order.status !== "delivered" &&
      order.status !== "cancelled"
    ) {
      const daysRemaining = Math.ceil(
        (order.expectedDeliveryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysRemaining < 0) deadlineUrgency = "overdue";
      else if (daysRemaining <= 5) deadlineUrgency = "urgent";
      else if (daysRemaining <= 10) deadlineUrgency = "approaching";
      else deadlineUrgency = "ok";
    }
    return { ...order, deadlineUrgency };
  });

  const statusFilters = [
    { value: "all", label: "Všechny" },
    { value: "pending", label: "Čeká" },
    { value: "confirmed", label: "Potvrzeno" },
    { value: "paid", label: "Zaplaceno" },
    { value: "shipped", label: "Odesláno" },
    { value: "delivered", label: "Doručeno" },
    { value: "cancelled", label: "Zrušeno" },
  ];

  const activeStatus = params.status || "all";
  const isFiltered = query || (params.status && params.status !== "all");

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Objednávky
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orders.length}{" "}
            {orders.length === 1
              ? "objednávka"
              : orders.length >= 2 && orders.length <= 4
                ? "objednávky"
                : "objednávek"}
            {isFiltered && " (filtrováno)"}
          </p>
        </div>
        <Suspense fallback={null}>
          <OrderExportButton />
        </Suspense>
      </div>

      {/* Search */}
      <div className="mt-4 max-w-md">
        <Suspense fallback={null}>
          <OrderSearch />
        </Suspense>
      </div>

      {/* Status filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        {statusFilters.map((filter) => {
          const href = new URLSearchParams();
          if (filter.value !== "all") href.set("status", filter.value);
          if (query) href.set("q", query);
          const hrefStr = href.toString();
          return (
            <Link
              key={filter.value}
              href={`/admin/orders${hrefStr ? `?${hrefStr}` : ""}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeStatus === filter.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {/* Orders table */}
      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
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
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Žádné objednávky
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {order.customer.firstName} {order.customer.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.customer.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground"}`}
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
                      {order._count.items}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
