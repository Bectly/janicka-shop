"use server";

import { getDb } from "@/lib/db";
import { getOrCreateVisitorId, MIN_REFRESH_MS, RESERVATION_MS } from "@/lib/visitor";
import { rateLimitReservation } from "@/lib/rate-limit";

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
  const rl = await rateLimitReservation();
  if (!rl.success) {
    return { success: false, error: "Příliš mnoho požadavků, zkuste to za chvíli" };
  }

  const visitorId = await getOrCreateVisitorId();
  const now = new Date();
  const reservedUntil = new Date(now.getTime() + RESERVATION_MS);

  const db = await getDb();

  // Atomic conditional update — prevents TOCTOU race where two concurrent
  // "Add to cart" clicks both read the product as available and the second
  // silently overwrites the first visitor's reservation.
  const result = await db.product.updateMany({
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
    const product = await db.product.findUnique({
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
  const visitorId = await getOrCreateVisitorId();
  const db = await getDb();

  await db.product.updateMany({
    where: {
      id: productId,
      reservedBy: visitorId,
    },
    data: { reservedUntil: null, reservedBy: null },
  });
}

/**
 * Refresh reservations for all items in cart (called on cart page mount).
 *
 * Threshold-based: only extends a visitor's own reservation when it has less
 * than MIN_REFRESH_MINUTES remaining. With ≥ MIN_REFRESH_MINUTES left the
 * existing reservedUntil is preserved, so a page refresh does NOT reset the
 * visible countdown back to the full window. Already-expired slots are left
 * untouched — the cart UI surfaces them via the existing 0:00 / "Rezervace
 * vypršela" badge instead of silently grabbing a fresh window.
 *
 * Returns map of productId → reservedUntil ISO string (active or expired,
 * always belonging to this visitor), or null if the product is no longer
 * available to this visitor (sold, inactive, or claimed by someone else).
 */
export async function extendReservations(
  productIds: string[]
): Promise<Record<string, string | null>> {
  if (productIds.length === 0) return {};

  const rl = await rateLimitReservation();
  if (!rl.success) return {};
  // Cap array size to prevent abuse via crafted requests
  if (productIds.length > 50) productIds = productIds.slice(0, 50);

  const visitorId = await getOrCreateVisitorId();
  const now = new Date();
  const refreshThreshold = new Date(now.getTime() + MIN_REFRESH_MS);
  const newReservedUntil = new Date(now.getTime() + RESERVATION_MS);

  const db = await getDb();

  // Atomic conditional extend — only when this visitor's slot is about to
  // expire (< MIN_REFRESH_MINUTES remaining but not yet expired). Slots with
  // > MIN_REFRESH_MINUTES are preserved so refresh keeps the same countdown;
  // already-expired slots are intentionally not re-grabbed silently. Visitor
  // scoping prevents overwriting another visitor's reservation.
  await db.product.updateMany({
    where: {
      id: { in: productIds },
      active: true,
      sold: false,
      reservedBy: visitorId,
      reservedUntil: { gt: now, lt: refreshThreshold },
    },
    data: { reservedUntil: newReservedUntil },
  });

  // Read back current state per product to compose the response.
  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, reservedBy: true, reservedUntil: true },
  });

  const result: Record<string, string | null> = {};
  for (const product of products) {
    if (product.reservedBy === visitorId && product.reservedUntil) {
      // Visitor still owns the slot — return whatever the current expiry is.
      // May be in the past (expired): the cart countdown will hit 0:00 and the
      // existing UI badge ("Rezervace vypršela") prompts manual re-reservation.
      result[product.id] = product.reservedUntil.toISOString();
    } else {
      // Sold, inactive, released, or held by another visitor → not available.
      result[product.id] = null;
    }
  }

  for (const id of productIds) {
    if (!(id in result)) result[id] = null;
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

  const visitorId = await getOrCreateVisitorId();
  const now = new Date();
  const result: Record<
    string,
    "available" | "reserved_by_you" | "reserved" | "sold"
  > = {};

  const db = await getDb();
  const products = await db.product.findMany({
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
