import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import { connection } from "next/server";

import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/constants";
import { Users, Mail, Phone, MapPin } from "lucide-react";
import Link from "next/link";
import { Pagination } from "@/components/shop/pagination";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zákazníci",
};

const ADMIN_CUSTOMERS_PER_PAGE = 25;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);

  await connection();
  const db = await getDb();

  const [totalCount, customers] = await Promise.all([
    db.customer.count(),
    db.customer.findMany({
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ADMIN_CUSTOMERS_PER_PAGE,
      take: ADMIN_CUSTOMERS_PER_PAGE,
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    }),
  ]);

  const customersWithStats = customers.map((customer) => {
    const validOrders = customer.orders.filter(
      (o) => o.status !== "cancelled",
    );
    const totalSpent = validOrders.reduce((sum, o) => sum + o.total, 0);
    const lastOrder = customer.orders[0] ?? null;
    return {
      ...customer,
      orderCount: customer.orders.length,
      totalSpent,
      lastOrder,
    };
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Zákazníci
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount}{" "}
            {totalCount === 1
              ? "zákazník"
              : totalCount >= 2 && totalCount <= 4
                ? "zákazníci"
                : "zákazníků"}{" "}
            celkem
          </p>
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="mt-12 rounded-xl border bg-card p-12 text-center shadow-sm">
          <Users className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            Zatím žádní zákazníci
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Zákazníci se vytvoří automaticky při první objednávce.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Zákazník
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Kontakt
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Objednávky
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Utraceno
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Poslední objednávka
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Registrace
                  </th>
                </tr>
              </thead>
              <tbody>
                {customersWithStats.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {customer.firstName} {customer.lastName}
                      </Link>
                      {customer.city && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" />
                          {customer.city}
                          {customer.zip ? `, ${customer.zip}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="size-3.5" />
                        <span className="text-xs">{customer.email}</span>
                      </p>
                      {customer.phone && (
                        <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="size-3.5" />
                          <span className="text-xs">{customer.phone}</span>
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-lg font-bold text-foreground">
                        {customer.orderCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatPrice(customer.totalSpent)}
                    </td>
                    <td className="px-4 py-3">
                      {customer.lastOrder ? (
                        <div>
                          <Link
                            href={`/admin/orders/${customer.lastOrder.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {customer.lastOrder.orderNumber}
                          </Link>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_COLORS[customer.lastOrder.status] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {ORDER_STATUS_LABELS[customer.lastOrder.status] ??
                                customer.lastOrder.status}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(customer.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <Pagination
          totalItems={totalCount}
          perPage={ADMIN_CUSTOMERS_PER_PAGE}
          basePath="/admin/customers"
        />
      </Suspense>
    </>
  );
}
