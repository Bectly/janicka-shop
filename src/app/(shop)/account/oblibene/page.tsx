import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { WishlistGrid, type WishlistRow } from "./wishlist-grid";
import { WishlistMergeClient } from "./merge-client";

export const metadata: Metadata = {
  title: "Oblíbené — Janička",
};

export default async function AccountWishlistPage() {
  await connection();
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account/oblibene");
  }

  const db = await getDb();
  const rows = await db.customerWishlist.findMany({
    where: { customerId: session.user.id },
    include: {
      product: {
        include: { category: { select: { name: true, slug: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const items: WishlistRow[] = rows
    .filter((r) => r.product.active)
    .map((r) => ({
      id: r.product.id,
      name: r.product.name,
      slug: r.product.slug,
      price: r.product.price,
      compareAt: r.product.compareAt,
      images: r.product.images,
      brand: r.product.brand,
      condition: r.product.condition,
      categoryName: r.product.category.name,
      categorySlug: r.product.category.slug,
      sold: r.product.sold,
    }))
    .sort((a, b) => (a.sold === b.sold ? 0 : a.sold ? 1 : -1));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold">Oblíbené kousky</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tvoje uložené kousky. Každý je unikát — jakmile se některý prodá,
          označíme ho a doporučíme podobné.
        </p>
      </div>
      <WishlistMergeClient />
      <WishlistGrid items={items} />
    </div>
  );
}
