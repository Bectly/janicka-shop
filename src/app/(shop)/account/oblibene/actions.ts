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

export async function addToWishlist(
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { ok: false, error: "Nejste přihlášena." };
  }

  const db = await getDb();
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { active: true },
  });
  if (!product?.active) {
    return { ok: false, error: "Produkt není dostupný." };
  }

  await db.customerWishlist.upsert({
    where: {
      customerId_productId: { customerId: session.user.id, productId },
    },
    create: { customerId: session.user.id, productId },
    update: {},
  });
  await logEvent({
    customerId: session.user.id,
    action: "wishlist_add",
    metadata: { productId },
  });

  invalidateCustomerScope(session.user.id, "wishlist");
  return { ok: true };
}

export async function toggleWishlist(
  productId: string,
): Promise<{ ok: boolean; added: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { ok: false, added: false, error: "Nejste přihlášena." };
  }

  const db = await getDb();
  const customerId = session.user.id;

  const existing = await db.customerWishlist.findUnique({
    where: { customerId_productId: { customerId, productId } },
    select: { customerId: true },
  });

  if (existing) {
    await db.customerWishlist.deleteMany({
      where: { customerId, productId },
    });
    await logEvent({
      customerId,
      action: "wishlist_remove",
      metadata: { productId },
    });
    invalidateCustomerScope(customerId, "wishlist");
    return { ok: true, added: false };
  }

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { active: true },
  });
  if (!product?.active) {
    return { ok: false, added: false, error: "Produkt není dostupný." };
  }

  await db.customerWishlist.upsert({
    where: { customerId_productId: { customerId, productId } },
    create: { customerId, productId },
    update: {},
  });
  await logEvent({
    customerId,
    action: "wishlist_add",
    metadata: { productId },
  });
  invalidateCustomerScope(customerId, "wishlist");
  return { ok: true, added: true };
}
