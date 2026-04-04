import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { CollectionForm } from "../collection-form";

export const metadata: Metadata = {
  title: "Nová kolekce",
};

export default async function NewCollectionPage() {
  const db = await getDb();
  const products = await db.product.findMany({
    where: { active: true, sold: false },
    select: { id: true, name: true, slug: true, price: true, images: true, brand: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Nová kolekce
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vytvořte tematickou sbírku produktů.
      </p>

      <div className="mt-6 max-w-2xl">
        <CollectionForm allProducts={products} />
      </div>
    </>
  );
}
