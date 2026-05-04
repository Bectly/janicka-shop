import { getDb } from "@/lib/db";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import type { Metadata } from "next";
import { CollectionForm } from "../../collection-form";

export const metadata: Metadata = {
  title: "Upravit kolekci",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCollectionPage({ params }: Props) {
  await connection();
  const { id } = await params;
  const db = await getDb();

  const [collection, products] = await Promise.all([
    db.collection.findUnique({ where: { id } }),
    db.product.findMany({
      where: { active: true, sold: false },
      select: { id: true, name: true, slug: true, price: true, images: true, brand: true, condition: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);

  if (!collection) notFound();

  return (
    <>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Upravit kolekci
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {collection.title}
      </p>

      <div className="mt-6 max-w-2xl">
        <CollectionForm collection={collection} allProducts={products} />
      </div>
    </>
  );
}
