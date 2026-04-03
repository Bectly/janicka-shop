import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Objednávky",
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;

  const where: Record<string, unknown> = {};
  if (params.status && params.status !== "all") {
    where.status = params.status;
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: {
        select: { firstName: true, lastName: true, email: true },
      },
      _count: { select: { items: true } },
    },
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

  return (
    <>
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
        </p>
      </div>

      {/* Status filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        {statusFilters.map((filter) => (
          <Link
            key={filter.value}
            href={
              filter.value === "all"
                ? "/admin/orders"
                : `/admin/orders?status=${filter.value}`
            }
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeStatus === filter.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {filter.label}
          </Link>
        ))}
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
