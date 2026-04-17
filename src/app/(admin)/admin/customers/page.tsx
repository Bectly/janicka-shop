import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import { connection } from "next/server";

import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/constants";
import { Users, Mail, Phone, MapPin, StickyNote } from "lucide-react";
import Link from "next/link";
import { Pagination } from "@/components/shop/pagination";
import { CustomerSearchInput } from "./customer-search-input";
import { CustomerTagFilter } from "./customer-tag-filter";
import { ExportCustomersCsvButton } from "./export-customers-csv-button";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = {
  title: "Zákazníci",
};

const ADMIN_CUSTOMERS_PER_PAGE = 25;

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((t): t is string => typeof t === "string");
  } catch {
    return [];
  }
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; tag?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);
  const query = (params.q ?? "").trim();
  const tag = (params.tag ?? "").trim();

  await connection();
  const db = await getDb();

  const where: Prisma.CustomerWhereInput = {};
  if (query) {
    where.OR = [
      { email: { contains: query } },
      { firstName: { contains: query } },
      { lastName: { contains: query } },
    ];
  }
  if (tag) {
    where.tags = { contains: `"${tag}"` };
  }

  const [totalCount, customers, allTagsRaw] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
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
        },
      },
    }),
    // Fetch tag strings from all customers to build the filter chip row.
    // Limited to 1000 recent records to keep this cheap; covers practical usage.
    db.customer.findMany({
      where: { tags: { not: "[]" } },
      select: { tags: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    }),
  ]);

  const allTagCounts = new Map<string, number>();
  for (const row of allTagsRaw) {
    for (const t of parseTags(row.tags)) {
      allTagCounts.set(t, (allTagCounts.get(t) ?? 0) + 1);
    }
  }
  const allTags = [...allTagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "cs-CZ"))
    .slice(0, 20)
    .map(([t]) => t);

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
      parsedTags: parseTags(customer.tags),
      hasNote: !!customer.internalNote?.trim(),
    };
  });

  const isFiltered = !!query || !!tag;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Zákazníci
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount}{" "}
            {totalCount === 1
              ? "zákaznice"
              : totalCount >= 2 && totalCount <= 4
                ? "zákaznice"
                : "zákaznic"}{" "}
            {isFiltered ? "odpovídá filtru" : "celkem"}
          </p>
        </div>
        <ExportCustomersCsvButton
          q={query || undefined}
          tag={tag || undefined}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <CustomerSearchInput initialValue={query} />
        <CustomerTagFilter tags={allTags} activeTag={tag || null} />
      </div>

      {totalCount === 0 ? (
        <div className="mt-12 rounded-xl border bg-card p-12 text-center shadow-sm">
          <Users className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            {isFiltered
              ? "Žádné zákaznice neodpovídají filtru"
              : "Zatím žádné zákaznice"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFiltered
              ? "Zkus upravit hledaný výraz nebo zrušit filtr tagem."
              : "Zákaznice se vytvoří automaticky při první objednávce."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Zákaznice
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Kontakt
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Tagy
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
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {customer.firstName} {customer.lastName}
                        </Link>
                        {customer.hasNote && (
                          <StickyNote
                            className="size-3.5 text-amber-500"
                            aria-label="Má interní poznámku"
                          />
                        )}
                      </div>
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
                    <td className="px-4 py-3">
                      {customer.parsedTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {customer.parsedTags.slice(0, 4).map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                            >
                              {t}
                            </span>
                          ))}
                          {customer.parsedTags.length > 4 && (
                            <span className="text-xs text-muted-foreground">
                              +{customer.parsedTags.length - 4}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
