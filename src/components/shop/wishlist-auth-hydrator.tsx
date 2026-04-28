import { cacheLife, cacheTag } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { customerTag } from "@/lib/customer-cache";
import { WishlistAuthHydratorClient } from "./wishlist-auth-hydrator-client";

async function getCustomerWishlistIds(customerId: string): Promise<string[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(customerTag(customerId, "wishlist"));

  const db = await getDb();
  const rows = await db.customerWishlist.findMany({
    where: { customerId },
    select: { productId: true },
  });
  return rows.map((r) => r.productId);
}

export async function WishlistAuthHydrator() {
  const session = await auth();
  if (session?.user?.role !== "customer") {
    return <WishlistAuthHydratorClient role={null} wishlistIds={[]} />;
  }
  let ids: string[] = [];
  try {
    ids = await getCustomerWishlistIds(session.user.id);
  } catch {
    // DB unavailable — hydrator no-ops; client falls back to localStorage Zustand.
  }
  return <WishlistAuthHydratorClient role="customer" wishlistIds={ids} />;
}
