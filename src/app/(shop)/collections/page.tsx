import Link from "next/link";
import { getDb } from "@/lib/db";
import { connection } from "next/server";
import { CollectionCard } from "@/components/shop/collection-card";

import { Layers } from "lucide-react";
import type { Metadata } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

export const metadata: Metadata = {
  title: "Kolekce",
  description:
    "Prohlédněte si naše kurátorské kolekce — tematické výběry unikátních second hand kousků.",
  alternates: { canonical: `${BASE_URL}/collections` },
};

export default async function CollectionsPage() {
  await connection();
  const db = await getDb();
  const now = new Date();

  const activeCollections = await db.collection.findMany({
    where: {
      active: true,
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  // Count available products per collection — single DB query for all collections
  const allProductIdSets = activeCollections.map((c) => {
    try { return JSON.parse(c.productIds) as string[]; } catch { return [] as string[]; }
  });
  const allProductIds = [...new Set(allProductIdSets.flat())];
  const availableProductIds = allProductIds.length > 0
    ? (await db.product.findMany({
        where: { id: { in: allProductIds }, active: true, sold: false },
        select: { id: true },
      })).map((p) => p.id)
    : [];
  const availableSet = new Set(availableProductIds);
  const collectionsWithCounts = activeCollections.map((c, i) => ({
    ...c,
    availableCount: allProductIdSets[i].filter((id) => availableSet.has(id)).length,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-muted-foreground" aria-label="Navigace">
        <Link href="/" className="hover:text-foreground">
          Domů
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Kolekce</span>
      </nav>

      <div className="mb-8">
        <h1 className="font-heading text-[1.75rem] font-bold text-foreground sm:text-[2rem]">
          Kolekce
        </h1>
        <p className="mt-2 text-muted-foreground">
          Kurátorské výběry unikátních kousků podle tématu, sezóny a stylu.
        </p>
      </div>

      {collectionsWithCounts.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collectionsWithCounts.map((collection, i) => (
            <CollectionCard
              key={collection.id}
              slug={collection.slug}
              title={collection.title}
              description={collection.description}
              image={collection.image}
              availableCount={collection.availableCount}
              priority={i < 3}
              index={i}
              wide={i === 0 && collectionsWithCounts.length > 2}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <Layers className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg text-muted-foreground">
            Zatím nemáme žádné kolekce.
          </p>
          <Link
            href="/products"
            className="mt-4 inline-flex text-sm text-primary hover:underline"
          >
            Prohlédnout celý katalog
          </Link>
        </div>
      )}
    </div>
  );
}
