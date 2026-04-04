import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { Plus, Zap, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteProductButton } from "@/components/admin/delete-product-button";
import { ProductSearch } from "@/components/admin/product-search";
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

  const [totalCount, products, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { category: { select: { name: true } } },
      skip: (currentPage - 1) * ADMIN_PRODUCTS_PER_PAGE,
      take: ADMIN_PRODUCTS_PER_PAGE,
    }),
    prisma.category.findMany({
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

      {/* Products table */}
      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-14 px-3 py-3 text-left font-medium text-muted-foreground">
                  <span className="sr-only">Foto</span>
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Produkt
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                  Kategorie
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">
                  Značka
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                  Stav
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Cena
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {query
                      ? `Žádné produkty pro „${query}"`
                      : "Žádné produkty"}
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const images: string[] = (() => {
                    try {
                      return JSON.parse(product.images);
                    } catch {
                      return [];
                    }
                  })();
                  return (
                  <tr
                    key={product.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="w-14 px-3 py-3">
                      {images[0] ? (
                        <Image
                          src={images[0]}
                          alt=""
                          width={40}
                          height={40}
                          className="size-10 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                          <ImageIcon className="size-4 text-muted-foreground" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.sku}
                        </p>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {product.category.name}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {product.brand ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[product.condition] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {CONDITION_LABELS[product.condition] ?? product.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-4 py-3">
                      {product.sold ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Prodáno
                        </span>
                      ) : product.active ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Aktivní
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Skryto
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Upravit
                        </Link>
                        <DeleteProductButton
                          productId={product.id}
                          productName={product.name}
                        />
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
