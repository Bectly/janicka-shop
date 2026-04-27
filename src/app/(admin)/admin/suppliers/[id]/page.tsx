import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import type { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  FileSpreadsheet,
  Mail,
  Package,
  Phone,
} from "lucide-react";
import { getDb } from "@/lib/db";
import { getSiteSetting } from "@/lib/site-settings";
import { formatPrice } from "@/lib/format";
import { SupplierFormSheet } from "../supplier-form-sheet";
import { BundleFormSheet } from "./bundle-form-sheet";
import { ActiveBundleToggle } from "./active-bundle-toggle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const db = await getDb();
  const supplier = await db.supplier.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    title: supplier ? `${supplier.name} — Dodavatel` : "Dodavatel",
  };
}

async function getSupplier(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(`admin-supplier:${id}`);
  cacheTag("admin-suppliers");

  const db = await getDb();
  return db.supplier.findUnique({
    where: { id },
    include: {
      pricelists: {
        orderBy: { effectiveDate: "desc" },
        include: { _count: { select: { items: true } } },
      },
      bundles: {
        orderBy: { orderDate: "desc" },
        include: { _count: { select: { lines: true, products: true } } },
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
  received: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
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

function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;

  const [supplier, activeBundleId] = await Promise.all([
    getSupplier(id),
    getSiteSetting("activeBundleId"),
  ]);

  if (!supplier) notFound();

  const supplierFormValues = {
    id: supplier.id,
    name: supplier.name,
    url: supplier.url,
    contactEmail: supplier.contactEmail,
    contactPhone: supplier.contactPhone,
    notes: supplier.notes,
  };

  return (
    <>
      <div className="mb-4">
        <Link
          href="/admin/suppliers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Dodavatelé
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {supplier.name}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                supplier.active
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  supplier.active
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/50"
                }`}
              />
              {supplier.active ? "Aktivní" : "Neaktivní"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {supplier.url && (
              <a
                href={supplier.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <ExternalLink className="size-3.5" />
                {supplier.url}
              </a>
            )}
            {supplier.contactEmail && (
              <a
                href={`mailto:${supplier.contactEmail}`}
                className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <Mail className="size-3.5" />
                {supplier.contactEmail}
              </a>
            )}
            {supplier.contactPhone && (
              <a
                href={`tel:${supplier.contactPhone}`}
                className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
              >
                <Phone className="size-3.5" />
                {supplier.contactPhone}
              </a>
            )}
          </div>
        </div>
        <SupplierFormSheet supplier={supplierFormValues} trigger="icon" />
      </div>

      {supplier.notes && (
        <div className="mt-4 rounded-xl border bg-muted/30 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Poznámky
          </p>
          <pre className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-foreground">
            {supplier.notes}
          </pre>
        </div>
      )}

      {/* Pricelists */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Ceníky
          </h2>
          <span className="text-sm text-muted-foreground">
            {supplier.pricelists.length}
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {supplier.pricelists.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                <FileSpreadsheet className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Zatím žádný ceník
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ceníky se importují skriptem{" "}
                <code className="rounded bg-muted px-1 font-mono">
                  npm run import:opatex
                </code>
                .
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Platnost od
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Položek
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Zdrojový soubor
                  </th>
                </tr>
              </thead>
              <tbody>
                {supplier.pricelists.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium capitalize text-foreground">
                      {formatMonth(p.effectiveDate)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {p._count.items}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.sourceFile ? (
                        <code className="font-mono">{p.sourceFile}</code>
                      ) : (
                        <span className="italic">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Bundles */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Balíky
          </h2>
          <BundleFormSheet supplierId={supplier.id} />
        </div>
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          {supplier.bundles.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
                <Package className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Žádné balíky
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Vytvořte první balík tlačítkem „Nový balík“.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Datum
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Hmotnost
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Cena
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Stav
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Aktivní
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Akce
                  </th>
                </tr>
              </thead>
              <tbody>
                {supplier.bundles.map((b) => {
                  const isActive = activeBundleId === b.id;
                  const status = b.status ?? "ordered";
                  return (
                    <tr
                      key={b.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {formatDay(b.orderDate)}
                        </div>
                        {b.invoiceNumber && (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {b.invoiceNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {b.totalKg.toLocaleString("cs-CZ", {
                          maximumFractionDigits: 2,
                        })}{" "}
                        kg
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {formatPrice(b.totalPrice)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            STATUS_COLORS[status] ?? STATUS_COLORS.ordered
                          }`}
                        >
                          {STATUS_LABELS[status] ?? status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ActiveBundleToggle
                          bundleId={b.id}
                          isActive={isActive}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/bundles/${b.id}`}
                          className="inline-flex items-center gap-1 rounded-lg p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
                          title="Detail balíku"
                          aria-label="Otevřít detail balíku"
                        >
                          <ArrowRight className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
