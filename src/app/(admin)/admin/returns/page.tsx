import Link from "next/link";
import { getDb } from "@/lib/db";
import { connection } from "next/server";
import { formatPrice, formatDate } from "@/lib/format";
import {
  RETURN_STATUS_LABELS,
  RETURN_STATUS_COLORS,
  RETURN_REASON_LABELS,
} from "@/lib/constants";
import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Vratky",
};

export default async function AdminReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await connection();
  const db = await getDb();
  const params = await searchParams;

  const where: Record<string, unknown> = {};
  if (
    params.status &&
    params.status !== "all" &&
    ["pending", "approved", "rejected", "completed"].includes(params.status)
  ) {
    where.status = params.status;
  }

  const returns = await db.return.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      customer: {
        select: { firstName: true, lastName: true, email: true },
      },
      order: {
        select: { orderNumber: true },
      },
      _count: { select: { items: true } },
    },
  });

  const statusFilters = [
    { value: "all", label: "Všechny" },
    { value: "pending", label: "Čekající" },
    { value: "approved", label: "Schválené" },
    { value: "rejected", label: "Zamítnuté" },
    { value: "completed", label: "Dokončené" },
  ];

  const activeStatus = params.status || "all";
  const pendingCount = returns.filter((r) => r.status === "pending").length;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Vratky
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {returns.length}{" "}
            {returns.length === 1
              ? "vratka"
              : returns.length >= 2 && returns.length <= 4
                ? "vratky"
                : "vratek"}
            {pendingCount > 0 && activeStatus === "all" && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {pendingCount} k vyřízení
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        {statusFilters.map((filter) => {
          const href =
            filter.value === "all"
              ? "/admin/returns"
              : `/admin/returns?status=${filter.value}`;
          return (
            <Link
              key={filter.value}
              href={href}
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

      {/* Returns table */}
      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Číslo vratky
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Objednávka
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Zákazník
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Důvod
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Částka
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Datum
                </th>
              </tr>
            </thead>
            <tbody>
              {returns.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Žádné vratky
                  </td>
                </tr>
              ) : (
                returns.map((ret) => (
                  <tr
                    key={ret.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/returns/${ret.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {ret.returnNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${ret.orderId}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {ret.order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {ret.customer.firstName} {ret.customer.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ret.customer.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {RETURN_REASON_LABELS[ret.reason] ?? ret.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RETURN_STATUS_COLORS[ret.status] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {RETURN_STATUS_LABELS[ret.status] ?? ret.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatPrice(ret.refundAmount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(ret.createdAt)}
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
