import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import type { Metadata } from "next";
import { ArrowLeft, Package, PackageOpen, AlertTriangle } from "lucide-react";
import { getDb } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { StatusButtons } from "./status-buttons";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const db = await getDb();
  const bundle = await db.supplierBundle.findUnique({
    where: { id },
    select: { invoiceNumber: true, orderDate: true, supplier: { select: { name: true } } },
  });
  if (!bundle) return { title: "Balík" };
  const label = bundle.invoiceNumber ?? formatDay(bundle.orderDate);
  return { title: `${bundle.supplier.name} — ${label}` };
}

async function getBundle(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`admin-bundle:${id}`);

  const db = await getDb();
  return db.supplierBundle.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true } },
      lines: {
        orderBy: { code: "asc" },
        include: { _count: { select: { products: true } } },
      },
      products: {
        take: 50,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          sku: true,
          name: true,
          price: true,
          costBasis: true,
          sold: true,
        },
      },
    },
  });
}

const STATUS_LABELS: Record<string, string> = {
  ordered: "Objednáno",
  received: "Přijato",
  unpacked: "Rozbaleno",
  done: "Hotovo",
};

const STATUS_COLORS: Record<string, string> = {
  ordered:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  received:
    "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  unpacked:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  done:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function BundleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const bundle = await getBundle(id);

  if (!bundle) notFound();

  const status = bundle.status ?? "ordered";
  const statusLabel = STATUS_LABELS[status] ?? status;
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.ordered;

  // Profit summary
  const productsWithCost = bundle.products.filter(
    (p) => p.costBasis !== null && p.costBasis !== undefined,
  );
  const missingCostCount = bundle.products.length - productsWithCost.length;
  const sumRevenue = bundle.products.reduce((acc, p) => acc + p.price, 0);
  const sumProfit = productsWithCost.reduce(
    (acc, p) => acc + (p.price - (p.costBasis ?? 0)),
    0,
  );
  const avgMargin =
    sumRevenue > 0 ? Math.round((sumProfit / sumRevenue) * 100) : 0;

  const canUnpack = status === "received" || status === "unpacked";

  return (
    <>
      <div className="mb-4">
        <Link
          href={`/admin/suppliers/${bundle.supplier.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {bundle.supplier.name}
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {bundle.invoiceNumber
                ? bundle.invoiceNumber
                : `Balík ${formatDay(bundle.orderDate)}`}
            </h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusColor}`}
            >
              {statusLabel}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              {bundle.totalKg.toLocaleString("cs-CZ", {
                maximumFractionDigits: 2,
              })}{" "}
              kg
            </span>
            <span>{formatPrice(bundle.totalPrice)}</span>
            <span>Objednáno: {formatDay(bundle.orderDate)}</span>
            {bundle.receivedDate && (
              <span>Přijato: {formatDay(bundle.receivedDate)}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canUnpack && (
            <Link
              href={`/admin/bundles/${id}/unpack`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
            >
              <PackageOpen className="size-4" />
              Rozbalit
            </Link>
          )}
          <StatusButtons bundleId={id} status={status} />
        </div>
      </div>

      {/* Lines table */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Kategorie
          </h2>
          <span className="text-sm text-muted-foreground">
            {bundle.lines.length}
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {bundle.lines.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                <Package className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Žádné kategorie
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Kategorie se přidají při importu ceníku.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Kód
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Název
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    kg
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Kč/kg
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Celkem
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Kusů
                  </th>
                </tr>
              </thead>
              <tbody>
                {bundle.lines.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {line.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {line.name}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {line.kg.toLocaleString("cs-CZ", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {line.pricePerKg.toLocaleString("cs-CZ", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatPrice(line.totalPrice)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {line._count.products}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Linked products */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Propojené kousky
          </h2>
          <span className="text-sm text-muted-foreground">
            {bundle.products.length}
            {bundle.products.length === 50 && "+"}
          </span>
        </div>

        {missingCostCount > 0 && (
          <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/50 dark:bg-amber-900/20">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-amber-800 dark:text-amber-300">
              {missingCostCount === 1
                ? "1 kus nemá"
                : `${missingCostCount} kusů nemá`}{" "}
              vyplněnou nákladovou cenu (costBasis) — zisk nebude přesný.
            </span>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {bundle.products.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                <Package className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Žádné kousky
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Kousky se přiřadí při rozbalení balíku.
              </p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Název
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Cena
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Náklad
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Zisk
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Stav
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.products.map((p) => {
                    const profit =
                      p.costBasis !== null && p.costBasis !== undefined
                        ? p.price - p.costBasis
                        : null;
                    return (
                      <tr
                        key={p.id}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="hover:text-foreground hover:underline"
                          >
                            {p.sku}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {p.name}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-foreground">
                          {formatPrice(p.price)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {p.costBasis !== null && p.costBasis !== undefined
                            ? formatPrice(p.costBasis)
                            : <span className="italic text-amber-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {profit !== null ? (
                            <span
                              className={
                                profit >= 0
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-destructive"
                              }
                            >
                              {formatPrice(profit)}
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.sold ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                              Prodáno
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              Skladem
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer summary */}
              <div className="border-t bg-muted/30 px-4 py-3">
                <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm">
                  <span className="text-muted-foreground">
                    Celkové tržby:{" "}
                    <span className="font-medium text-foreground">
                      {formatPrice(sumRevenue)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Celkový zisk:{" "}
                    <span
                      className={`font-medium ${sumProfit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}
                    >
                      {formatPrice(sumProfit)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Průměrná marže:{" "}
                    <span className="font-medium text-foreground">
                      {avgMargin} %
                    </span>
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
