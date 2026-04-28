import type { Metadata } from "next";
import { connection } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { Heart } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { customerTag } from "@/lib/customer-cache";
import { AccountNav } from "../account/account-nav";
import { WishlistContent } from "./wishlist-content";
import { WishlistGrid, type WishlistRow } from "./wishlist-grid";
import { WishlistMergeClient } from "./merge-client";

export const metadata: Metadata = {
  title: "Oblíbené",
  description: "Vaše oblíbené kousky na jednom místě.",
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

export default async function WishlistPage() {
  await connection();
  const session = await auth();
  const isCustomer = session?.user?.role === "customer";

  const heading = (
    <div className="mb-8 flex flex-col items-start gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
        <Heart className="size-3 fill-current" />
        Tvůj výběr
      </span>
      <h1 className="font-heading text-[1.75rem] font-bold text-foreground sm:text-3xl">
        Oblíbené kousky
      </h1>
      <p className="text-sm text-muted-foreground">
        {isCustomer
          ? "Tvoje uložené kousky. Každý je unikát — jakmile se některý prodá, označíme ho a doporučíme podobné."
          : "Vaše vybrané kousky na jednom místě — vždy po ruce"}
      </p>
    </div>
  );

  if (isCustomer) {
    const items = await getCustomerWishlist(session.user.id);
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <AccountNav />
          <main className="min-w-0">
            {heading}
            <WishlistMergeClient dbIds={items.map((i) => i.id)} />
            <WishlistGrid items={items} />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {heading}
      <WishlistContent />
    </div>
  );
}
