"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

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

  revalidatePath("/account/oblibene");
  return { ok: true };
}
