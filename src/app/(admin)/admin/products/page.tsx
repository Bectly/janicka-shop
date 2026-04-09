import { Suspense } from "react";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { connection } from "next/server";

import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductSearch } from "@/components/admin/product-search";
import { BulkProductTable } from "@/components/admin/bulk-product-table";
import { Pagination } from "@/components/shop/pagination";
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

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    status?: string;
    category?: string;
  }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);
  const query = params.q?.trim() ?? "";
  const statusFilter = params.status ?? "all";
  const categoryFilter = params.category ?? "";

  // Build Prisma where clause
  const where: Prisma.ProductWhereInput = {};

  // Status filter
  if (statusFilter === "active") {
    where.active = true;
    where.sold = false;
  } else if (statusFilter === "sold") {
    where.sold = true;
  } else if (statusFilter === "hidden") {
    where.active = false;
    where.sold = false;
  }

  // Category filter
  if (categoryFilter) {
    where.categoryId = categoryFilter;
  }

  // Search by name, SKU, or brand
  if (query) {
    where.OR = [
      { name: { contains: query } },
      { sku: { contains: query } },
      { brand: { contains: query } },
    ];
  }

  await connection();
  const db = await getDb();

  const [totalCount, products, categories] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { category: { select: { name: true } } },
      skip: (currentPage - 1) * ADMIN_PRODUCTS_PER_PAGE,
      take: ADMIN_PRODUCTS_PER_PAGE,
    }),
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Build URL helper preserving other params
  function filterUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (categoryFilter) p.set("category", categoryFilter);
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
            {query || statusFilter !== "all" || categoryFilter
              ? " (filtrováno)"
              : " celkem"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/admin/products/quick-add" />}>
            <Zap className="size-4" />
            <span className="hidden sm:inline">Rychlé přidání</span>
            <span className="sm:hidden">Rychle</span>
          </Button>
          <Button render={<Link href="/admin/products/new" />}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Přidat produkt</span>
            <span className="sm:hidden">Přidat</span>
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="mt-4 space-y-3">
        <Suspense fallback={null}>
          <ProductSearch />
        </Suspense>

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

      <Suspense fallback={null}>
        <Pagination
          totalItems={totalCount}
          perPage={ADMIN_PRODUCTS_PER_PAGE}
          basePath="/admin/products"
        />
      </Suspense>
    </>
  );
}
