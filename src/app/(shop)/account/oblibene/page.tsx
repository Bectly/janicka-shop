import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cacheLife, cacheTag } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { customerTag } from "@/lib/customer-cache";
import { WishlistGrid, type WishlistRow } from "./wishlist-grid";
import { WishlistMergeClient } from "./merge-client";

export const metadata: Metadata = {
  title: "Oblíbené — Janička",
};

async function getCustomerWishlist(customerId: string): Promise<WishlistRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(customerTag(customerId, "wishlist"));

  const db = await getDb();
  const rows = await db.customerWishlist.findMany({
    where: { customerId },
    include: {
      product: {
        include: { category: { select: { name: true, slug: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows
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
}

export default async function AccountWishlistPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account/oblibene");
  }

  const items = await getCustomerWishlist(session.user.id);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold">Oblíbené kousky</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tvoje uložené kousky. Každý je unikát — jakmile se některý prodá,
          označíme ho a doporučíme podobné.
        </p>
      </div>
      <WishlistMergeClient dbIds={items.map((i) => i.id)} />
      <WishlistGrid items={items} />
    </div>
  );
}
