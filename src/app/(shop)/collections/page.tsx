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
    <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
      {/* Editorial header — full-bleed brand-palette gradient */}
      <div className="relative -mx-4 mb-10 overflow-hidden sm:-mx-6 lg:-mx-8">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/[0.08] via-champagne-light/50 to-blush/60" />
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <nav className="mb-4 text-sm text-muted-foreground" aria-label="Navigace">
            <Link href="/" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center hover:text-foreground">
              Domů
            </Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">Kolekce</span>
          </nav>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
            <Layers className="size-3" />
            Kurátorský výběr
          </span>
          <h1 className="mt-2 font-heading text-[1.75rem] font-bold tracking-tight text-foreground sm:text-[2.25rem]">
            Kolekce
          </h1>
          <p className="mt-2 max-w-lg text-muted-foreground">
            Kurátorské výběry unikátních kousků podle tématu, sezóny a stylu.
          </p>
        </div>
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
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/[0.06] to-brand/[0.10] ring-1 ring-inset ring-primary/10">
            <Layers className="size-6 text-primary/50" />
          </div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Zatím žádné kolekce
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Brzy přidáme kurátorské výběry.
          </p>
          <Link
            href="/products"
            className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-4 py-1.5 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary/[0.10]"
          >
            <Layers className="size-3.5" />
            Prohlédnout celý katalog
          </Link>
        </div>
      )}
    </div>
  );
}
