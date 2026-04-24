"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/audit-log";
import { invalidateCustomerScope } from "@/lib/customer-cache";

export async function removeFromWishlist(
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { ok: false, error: "Nejste přihlášena." };
  }

  const db = await getDb();
  await db.customerWishlist.deleteMany({
    where: { customerId: session.user.id, productId },
  });
  await logEvent({
    customerId: session.user.id,
    action: "wishlist_remove",
    metadata: { productId },
  });

  invalidateCustomerScope(session.user.id, "wishlist");
  revalidatePath("/account/oblibene");
  return { ok: true };
}
