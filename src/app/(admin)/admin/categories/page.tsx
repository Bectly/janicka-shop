import { getDb } from "@/lib/db";
import Link from "next/link";
import { connection } from "next/server";

import { Layers, Plus } from "lucide-react";
import type { Metadata } from "next";
import { CategoryRow } from "./category-row";

export const metadata: Metadata = {
  title: "Kategorie",
};

export default async function AdminCategoriesPage() {
  await connection();
  const db = await getDb();
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Kategorie
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {categories.length}{" "}
            {categories.length === 1
              ? "kategorie"
              : categories.length >= 2 && categories.length <= 4
                ? "kategorie"
                : "kategorií"}
          </p>
        </div>
        <Link
          href="/admin/categories/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
        >
          <Plus className="size-4" />
          Přidat kategorii
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        {categories.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
              <Layers className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">Žádné kategorie</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vytvořte kategorii pro třídění produktů.
            </p>
            <Link
              href="/admin/categories/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
            >
              <Plus className="size-4" />
              Vytvořit první kategorii
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Pořadí
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Název
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Slug
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Produkty
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={{
                    id: category.id,
                    name: category.name,
                    slug: category.slug,
                    description: category.description,
                    sortOrder: category.sortOrder,
                    productCount: category._count.products,
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
