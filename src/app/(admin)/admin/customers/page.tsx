import { Suspense } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";

import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/constants";
import {
  Users,
  Mail,
  Phone,
  MapPin,
  StickyNote,
  Ban,
  Lock,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Pagination, PaginationSkeleton } from "@/components/shop/pagination";
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

type Sort = "recent" | "alpha" | "spent";
type VerifiedFilter = "any" | "yes" | "no";
type OrdersFilter = "any" | "yes" | "no";

async function getCustomersPageData(
  currentPage: number,
  query: string,
  tag: string,
  sort: Sort,
  verified: VerifiedFilter,
  ordersFilter: OrdersFilter,
  lockedOnly: boolean,
  // Passed in so the "locked" window snaps in minute increments (cache key
  // stable within a minute) rather than thrashing on every request.
  lockedCutoffMs: number,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag("admin-customers");

  const db = await getDb();

  const where: Prisma.CustomerWhereInput = {};
  if (query) {
    where.OR = [
      { email: { contains: query } },
      { firstName: { contains: query } },
      { lastName: { contains: query } },
      { phone: { contains: query } },
    ];
  }
  if (tag) {
    where.tags = { contains: `"${tag}"` };
  }
  if (verified === "yes") where.emailVerified = { not: null };
  if (verified === "no") where.emailVerified = null;
  if (ordersFilter === "yes") where.orders = { some: {} };
  if (ordersFilter === "no") where.orders = { none: {} };
  if (lockedOnly) where.lockedUntil = { gt: new Date(lockedCutoffMs) };

  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    sort === "alpha"
      ? { lastName: "asc" }
      : sort === "spent"
        ? { updatedAt: "desc" }
        : { createdAt: "desc" };

  const [totalCount, customers, allTagsRaw] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy,
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
    db.customer.findMany({
      where: { tags: { not: "[]" } },
      select: { tags: true },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    }),
  ]);

  return { totalCount, customers, allTagsRaw };
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    tag?: string;
    sort?: string;
    verified?: string;
    orders?: string;
    locked?: string;
  }>;
}) {
  await connection();
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);
  const query = (params.q ?? "").trim();
  const tag = (params.tag ?? "").trim();
  const sort: Sort =
    params.sort === "alpha" || params.sort === "spent" || params.sort === "recent"
      ? params.sort
      : "recent";
  const verified: VerifiedFilter =
    params.verified === "yes" || params.verified === "no" ? params.verified : "any";
  const ordersFilter: OrdersFilter =
    params.orders === "yes" || params.orders === "no" ? params.orders : "any";
  const lockedOnly = params.locked === "1";

  // Snap "now" to the minute so the cache key is stable for a minute window.
  const minuteBucket = Math.floor(Date.now() / 60_000) * 60_000;
  const { totalCount, customers, allTagsRaw } = await getCustomersPageData(
    currentPage,
    query,
    tag,
    sort,
    verified,
    ordersFilter,
    lockedOnly,
    minuteBucket,
  );

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

  // eslint-disable-next-line react-hooks/purity -- request-time read in RSC, not cached
  const now = Date.now();
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
      isLocked:
        !!customer.lockedUntil && customer.lockedUntil.getTime() > now,
    };
  });

  if (sort === "spent") {
    customersWithStats.sort((a, b) => b.totalSpent - a.totalSpent);
  }

  const isFiltered =
    !!query || !!tag || verified !== "any" || ordersFilter !== "any" || lockedOnly;

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

      <form
        method="get"
        className="mt-3 flex flex-wrap items-center gap-3 text-xs"
      >
        {query && <input type="hidden" name="q" value={query} />}
        {tag && <input type="hidden" name="tag" value={tag} />}
        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          Řadit
          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border bg-background px-2 py-1"
          >
            <option value="recent">Nejnovější</option>
            <option value="spent">Dle utraceno</option>
            <option value="alpha">Abecedně</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          Email
          <select
            name="verified"
            defaultValue={verified}
            className="rounded-md border bg-background px-2 py-1"
          >
            <option value="any">Vše</option>
            <option value="yes">Ověřen</option>
            <option value="no">Neověřen</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          Objednávky
          <select
            name="orders"
            defaultValue={ordersFilter}
            className="rounded-md border bg-background px-2 py-1"
          >
            <option value="any">Vše</option>
            <option value="yes">Má objednávky</option>
            <option value="no">Bez objednávek</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-muted-foreground">
          <input
            type="checkbox"
            name="locked"
            value="1"
            defaultChecked={lockedOnly}
            className="accent-primary"
          />
          Jen uzamčené
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Použít
        </button>
      </form>

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
                      <div className="flex flex-wrap items-center gap-2">
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
                        {customer.deletedAt && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            <Ban className="size-3" />
                            smazán
                          </span>
                        )}
                        {customer.disabled && !customer.deletedAt && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            <Ban className="size-3" />
                            blokován
                          </span>
                        )}
                        {customer.isLocked && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                            <Lock className="size-3" />
                            uzamčen
                          </span>
                        )}
                        {customer.emailVerified && (
                          <ShieldCheck
                            className="size-3.5 text-sky-600"
                            aria-label="Email ověřen"
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

      <Suspense fallback={<PaginationSkeleton />}>
        <Pagination
          totalItems={totalCount}
          perPage={ADMIN_CUSTOMERS_PER_PAGE}
          basePath="/admin/customers"
        />
      </Suspense>
    </>
  );
}
