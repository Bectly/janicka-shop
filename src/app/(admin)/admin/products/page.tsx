import { Suspense } from "react";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { getDb } from "@/lib/db";

import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductSearch } from "@/components/admin/product-search";
import { BulkProductTable } from "@/components/admin/bulk-product-table";
import { QuickAddToast } from "@/components/admin/quick-add-toast";
import { QrBatchModal } from "@/components/admin/qr-batch-modal";
import { PhotoAddCTA } from "@/components/admin/photo-add-cta";
import { Pagination, PaginationSkeleton } from "@/components/shop/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = {
  title: "Produkty",
};

const ADMIN_PRODUCTS_PER_PAGE = 25;

const STATUS_FILTERS = [
  { value: "all", label: "Všechny" },
  { value: "active", label: "Aktivní" },
  { value: "sold", label: "Prodáno" },
  { value: "hidden", label: "Skryto" },
];

type MissingKind = "images" | "measurements" | "defects" | "video" | "fitnote";
const MISSING_KINDS: MissingKind[] = ["images", "measurements", "defects", "video", "fitnote"];
const MISSING_LABELS: Record<MissingKind, string> = {
  images: "bez 4+ fotek",
  measurements: "bez měr (hruď + délka)",
  defects: "použité bez popisu závad",
  video: "bez videa",
  fitnote: "bez poznámky k střihu",
};
const NEW_CONDITIONS = new Set(["new_with_tags", "new_without_tags"]);

function parseJsonArray(raw: string): unknown[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function hasChestAndLength(raw: string): boolean {
  try {
    const m = JSON.parse(raw) as Record<string, unknown>;
    const chest = m?.chest;
    const length = m?.length;
    const filled = (v: unknown) =>
      typeof v === "number" || (typeof v === "string" && v.trim() !== "");
    return filled(chest) && filled(length);
  } catch {
    return false;
  }
}

async function getProductsPageData(
  currentPage: number,
  query: string,
  statusFilter: string,
  categoryFilter: string,
  missingFilter: MissingKind | null,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag("admin-products");

  const db = await getDb();

  const where: Prisma.ProductWhereInput = {};
  if (statusFilter === "active") {
    where.active = true;
    where.sold = false;
  } else if (statusFilter === "sold") {
    where.sold = true;
  } else if (statusFilter === "hidden") {
    where.active = false;
    where.sold = false;
  }
  if (categoryFilter) {
    where.categoryId = categoryFilter;
  }
  if (query) {
    where.OR = [
      { name: { contains: query } },
      { sku: { contains: query } },
      { brand: { contains: query } },
    ];
  }
  // When filtering by "missing" field, JSON-string fields require in-memory
  // filtering. Default the status to active unsold if caller didn't restrict
  // (catalog quality only matters for what's actually on sale).
  if (missingFilter && statusFilter === "all") {
    where.active = true;
    where.sold = false;
  }

  const categoriesPromise = db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  let totalCount: number;
  let products: Awaited<
    ReturnType<typeof db.product.findMany<{
      include: { category: { select: { name: true } } };
    }>>
  >;

  if (missingFilter) {
    const all = await db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { category: { select: { name: true } } },
    });

    const filtered = all.filter((p) => {
      if (missingFilter === "images") {
        return parseJsonArray(p.images).length < 4;
      }
      if (missingFilter === "measurements") {
        return !hasChestAndLength(p.measurements);
      }
      if (missingFilter === "video") {
        return !p.videoUrl || p.videoUrl.trim() === "";
      }
      if (missingFilter === "fitnote") {
        return !p.fitNote || p.fitNote.trim() === "";
      }
      if (NEW_CONDITIONS.has(p.condition)) return false;
      return !p.defectsNote || p.defectsNote.trim() === "";
    });

    totalCount = filtered.length;
    const start = (currentPage - 1) * ADMIN_PRODUCTS_PER_PAGE;
    products = filtered.slice(start, start + ADMIN_PRODUCTS_PER_PAGE);
  } else {
    [totalCount, products] = await Promise.all([
      db.product.count({ where }),
      db.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { category: { select: { name: true } } },
        skip: (currentPage - 1) * ADMIN_PRODUCTS_PER_PAGE,
        take: ADMIN_PRODUCTS_PER_PAGE,
      }),
    ]);
  }

  const categories = await categoriesPromise;
  return { products, totalCount, categories };
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    category?: string;
    missing?: string;
  }>;
}) {
  await connection();
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);
  const query = params.q?.trim() ?? "";
  const statusFilter = params.status ?? "all";
  const categoryFilter = params.category ?? "";
  const missingFilter = (
    MISSING_KINDS.includes(params.missing as MissingKind)
      ? (params.missing as MissingKind)
      : null
  );

  const { products, totalCount, categories } = await getProductsPageData(
    currentPage,
    query,
    statusFilter,
    categoryFilter,
    missingFilter,
  );

  // Build URL helper preserving other params
  function filterUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (categoryFilter) p.set("category", categoryFilter);
    if (missingFilter) p.set("missing", missingFilter);
    // Apply overrides
    for (const [k, v] of Object.entries(overrides)) {
      if (v) {
        p.set(k, v);
      } else {
        p.delete(k);
      }
    }
    p.delete("page"); // Always reset to page 1 on filter change
    const qs = p.toString();
    return `/admin/products${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <Suspense fallback={null}>
        <QuickAddToast />
      </Suspense>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Produkty
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount}{" "}
            {totalCount === 1
              ? "produkt"
              : totalCount >= 2 && totalCount <= 4
                ? "produkty"
                : "produktů"}
            {query || statusFilter !== "all" || categoryFilter || missingFilter
              ? " (filtrováno)"
              : " celkem"}
          </p>
        </div>
        <div className="flex gap-2">
          <QrBatchModal />
          <Button render={<Link href="/admin/products/new" />}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Přidat produkt</span>
            <span className="sm:hidden">Přidat</span>
          </Button>
        </div>
      </div>

      {/* J14 — pink jumbo CTA: prominent mobile-first entry to quick-add */}
      <div className="mt-5">
        <PhotoAddCTA />
      </div>

      {/* Search & Filters */}
      <div className="mt-4 space-y-3">
        <Suspense fallback={<Skeleton className="h-9 w-full rounded-lg" />}>
          <ProductSearch />
        </Suspense>

        {/* Missing-field filter (from dashboard coverage cards) */}
        {missingFilter && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="font-medium">K doplnění:</span>
            <span>{MISSING_LABELS[missingFilter]}</span>
            <span className="text-xs text-amber-700">• {totalCount} {totalCount === 1 ? "produkt" : totalCount >= 2 && totalCount <= 4 ? "produkty" : "produktů"}</span>
            <Link
              href={filterUrl({ missing: "" })}
              className="ml-auto rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-900 shadow-sm transition-colors hover:bg-amber-100"
            >
              Zrušit filtr ✕
            </Link>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter pills */}
          {STATUS_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={filterUrl({
                status: filter.value === "all" ? "" : filter.value,
              })}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === filter.value ||
                (filter.value === "all" && statusFilter === "")
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {filter.label}
            </Link>
          ))}

          {/* Category filter */}
          {categories.length > 0 && (
            <>
              <span className="mx-1 text-muted-foreground/40">|</span>
              <Link
                href={filterUrl({ category: "" })}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  !categoryFilter
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Vše
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={filterUrl({ category: cat.id })}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    categoryFilter === cat.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Products table with bulk actions */}
      <BulkProductTable products={products} query={query || undefined} />

      <Suspense fallback={<PaginationSkeleton />}>
        <Pagination
          totalItems={totalCount}
          perPage={ADMIN_PRODUCTS_PER_PAGE}
          basePath="/admin/products"
        />
      </Suspense>

      {/* Mobile-only Quick-Add FAB — one-tap access from product list on phones */}
      <Link
        href="/admin/products/quick-add"
        aria-label="Rychlé přidání produktu"
        className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95 sm:hidden"
      >
        <Zap className="size-6" />
      </Link>
    </>
  );
}
