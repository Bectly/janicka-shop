import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteProductButton } from "@/components/admin/delete-product-button";
import { Pagination } from "@/components/shop/pagination";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Produkty",
};

const ADMIN_PRODUCTS_PER_PAGE = 25;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);

  const [totalCount, products] = await Promise.all([
    prisma.product.count(),
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { category: { select: { name: true } } },
      skip: (currentPage - 1) * ADMIN_PRODUCTS_PER_PAGE,
      take: ADMIN_PRODUCTS_PER_PAGE,
    }),
  ]);

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
                : "produktů"}{" "}
            celkem
          </p>
        </div>
        <Button render={<Link href="/admin/products/new" />}>
          <Plus className="size-4" />
          Přidat produkt
        </Button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Produkt
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Kategorie
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Značka
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
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
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
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
                  <td className="px-4 py-3 text-muted-foreground">
                    {product.category.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {product.brand ?? "—"}
                  </td>
                  <td className="px-4 py-3">
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
              ))}
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
