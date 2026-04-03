"use server";

import { prisma } from "@/lib/db";
import { getVisitorId, RESERVATION_MS } from "@/lib/visitor";

/** Check if a product is available (not sold, not reserved by someone else) */
function isAvailable(product: {
  sold: boolean;
  active: boolean;
  reservedUntil: Date | null;
  reservedBy: string | null;
}, visitorId: string): boolean {
  if (product.sold || !product.active) return false;
  if (!product.reservedUntil) return true;
  if (product.reservedUntil < new Date()) return true; // expired reservation
  return product.reservedBy === visitorId; // reserved by this visitor
}

export type ReservationResult = {
  success: boolean;
  error?: string;
  reservedUntil?: string; // ISO string
};

/**
 * Reserve a product for the current visitor (15 min).
 * Called when adding to cart.
 */
export async function reserveProduct(
  productId: string
): Promise<ReservationResult> {
  const visitorId = await getVisitorId();
  const now = new Date();
  const reservedUntil = new Date(now.getTime() + RESERVATION_MS);

  // Atomic conditional update — prevents TOCTOU race where two concurrent
  // "Add to cart" clicks both read the product as available and the second
  // silently overwrites the first visitor's reservation.
  const result = await prisma.product.updateMany({
    where: {
      id: productId,
      active: true,
      sold: false,
      OR: [
        { reservedUntil: null },
        { reservedUntil: { lt: now } },
        { reservedBy: visitorId },
      ],
    },
    data: { reservedUntil, reservedBy: visitorId },
  });

  if (result.count === 0) {
    // Distinguish "not found" from "reserved by someone else"
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return { success: false, error: "Produkt nebyl nalezen" };
    }
    return {
      success: false,
      error: "Tento produkt je již rezervován nebo nedostupný",
    };
  }

  return { success: true, reservedUntil: reservedUntil.toISOString() };
}

/**
 * Release a reservation (when removing from cart).
 */
export async function releaseReservation(productId: string): Promise<void> {
  const visitorId = await getVisitorId();

  await prisma.product.updateMany({
    where: {
      id: productId,
      reservedBy: visitorId,
    },
    data: { reservedUntil: null, reservedBy: null },
  });
}

/**
 * Extend reservations for all items in cart (called on cart page load / periodically).
 * Returns map of productId → new reservedUntil ISO string, or null if product no longer available.
 */
export async function extendReservations(
  productIds: string[]
): Promise<Record<string, string | null>> {
  if (productIds.length === 0) return {};
  // Cap array size to prevent abuse via crafted requests
  if (productIds.length > 50) productIds = productIds.slice(0, 50);

  const visitorId = await getVisitorId();
  const now = new Date();
  const reservedUntil = new Date(now.getTime() + RESERVATION_MS);
  const result: Record<string, string | null> = {};

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      sold: true,
      active: true,
      reservedUntil: true,
      reservedBy: true,
    },
  });

  for (const product of products) {
    if (isAvailable(product, visitorId)) {
      await prisma.product.update({
        where: { id: product.id },
        data: { reservedUntil, reservedBy: visitorId },
      });
      result[product.id] = reservedUntil.toISOString();
    } else {
      result[product.id] = null; // no longer available
    }
  }

  // Products not found in DB
  for (const id of productIds) {
    if (!(id in result)) {
      result[id] = null;
    }
  }

  return result;
}

/**
 * Check reservation status for products (used on product pages).
 * Returns whether each product is available, reserved by current visitor, or reserved by someone else.
 */
export async function checkAvailability(
  productIds: string[]
): Promise<
  Record<string, "available" | "reserved_by_you" | "reserved" | "sold">
> {
  if (productIds.length === 0) return {};
  // Cap array size to prevent abuse via crafted requests
  if (productIds.length > 50) productIds = productIds.slice(0, 50);

  const visitorId = await getVisitorId();
  const now = new Date();
  const result: Record<
    string,
    "available" | "reserved_by_you" | "reserved" | "sold"
  > = {};

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      sold: true,
      active: true,
      reservedUntil: true,
      reservedBy: true,
    },
  });

  for (const product of products) {
    if (product.sold || !product.active) {
      result[product.id] = "sold";
    } else if (
      !product.reservedUntil ||
      product.reservedUntil < now
    ) {
      result[product.id] = "available";
    } else if (product.reservedBy === visitorId) {
      result[product.id] = "reserved_by_you";
    } else {
      result[product.id] = "reserved";
    }
  }

  return result;
}
