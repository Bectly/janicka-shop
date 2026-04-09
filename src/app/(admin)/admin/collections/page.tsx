import { getDb } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";
import { Plus, Layers } from "lucide-react";
import type { Metadata } from "next";
import { CollectionRow } from "./collection-row";

export const metadata: Metadata = {
  title: "Kolekce",
};

export default async function AdminCollectionsPage() {
  const db = await getDb();
  const collections = await db.collection.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  // Count products per collection
  const collectionsWithCounts = collections.map((c) => {
    let productCount = 0;
    try {
      const ids = JSON.parse(c.productIds);
      if (Array.isArray(ids)) productCount = ids.length;
    } catch { /* */ }
    return { ...c, productCount };
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Kolekce
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kurátorské sbírky produktů pro tematické nákupy.
          </p>
        </div>
        <Link
          href="/admin/collections/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Nová kolekce
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        {collections.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="mx-auto size-12 text-muted-foreground/30" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              Zatím žádné kolekce
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vytvořte tematické sbírky produktů pro lepší nákupní zážitek.
            </p>
            <Link
              href="/admin/collections/new"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Vytvořit první kolekci
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
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Produkty
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Stav
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody>
              {collectionsWithCounts.map((collection) => (
                <CollectionRow
                  key={collection.id}
                  collection={{
                    id: collection.id,
                    title: collection.title,
                    slug: collection.slug,
                    productCount: collection.productCount,
                    featured: collection.featured,
                    active: collection.active,
                    sortOrder: collection.sortOrder,
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
