import Link from "next/link";
import Image from "next/image";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
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

  // Count available products per collection
  const collectionsWithCounts = await Promise.all(
    activeCollections.map(async (c) => {
      let productIds: string[] = [];
      try { productIds = JSON.parse(c.productIds); } catch { /* */ }
      const availableCount = productIds.length > 0
        ? await db.product.count({
            where: { id: { in: productIds }, active: true, sold: false },
          })
        : 0;
      return { ...c, availableCount };
    }),
  );

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
        <h1 className="font-heading text-3xl font-bold text-foreground">
          Kolekce
        </h1>
        <p className="mt-2 text-muted-foreground">
          Kurátorské výběry unikátních kousků podle tématu, sezóny a stylu.
        </p>
      </div>

      {collectionsWithCounts.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {collectionsWithCounts.map((collection) => (
            <Link
              key={collection.id}
              href={`/collections/${collection.slug}`}
              className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Image */}
              <div className="aspect-[16/9] overflow-hidden bg-muted">
                {collection.image ? (
                  <Image
                    src={collection.image}
                    alt={collection.title}
                    width={640}
                    height={360}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Layers className="size-12 text-muted-foreground/20" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h2 className="font-heading text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {collection.title}
                </h2>
                {collection.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {collection.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {collection.availableCount}{" "}
                  {collection.availableCount === 1
                    ? "kousek"
                    : collection.availableCount >= 2 && collection.availableCount <= 4
                      ? "kousky"
                      : "kousků"}
                </p>
              </div>
            </Link>
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
