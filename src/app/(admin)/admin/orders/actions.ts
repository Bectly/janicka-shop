"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { sendOrderStatusEmail } from "@/lib/email";
import { rateLimitAdmin } from "@/lib/rate-limit";

const VALID_STATUSES = [
  "pending",
  "confirmed",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
];

/** Allowed status transitions: current → set of valid next statuses */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "paid", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [], // terminal state
  cancelled: ["pending"], // can only revert to pending for re-processing
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function updateOrderStatus(orderId: string, status: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Neplatný status objednávky");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, items: { select: { productId: true } } },
  });

  if (!order) throw new Error("Objednávka nenalezena");

  // Validate status transition
  const allowed = STATUS_TRANSITIONS[order.status];
  if (allowed && !allowed.includes(status)) {
    throw new Error(
      `Nelze změnit status z „${ORDER_STATUS_LABELS[order.status] ?? order.status}" na „${ORDER_STATUS_LABELS[status] ?? status}"`
    );
  }

  const productIds = order.items.map((i) => i.productId);

  // When cancelling an order, release the products back to catalog
  // (second-hand: each piece is unique, cancelled order = item available again)
  // Uses updateMany with status guard to prevent TOCTOU race: if a webhook
  // cancels first and a new checkout re-sells the product, the late admin
  // action safely no-ops instead of releasing the newly sold product.
  if (status === "cancelled" && order.status !== "cancelled") {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: { status: "cancelled" },
      });
      if (updated.count === 0) return; // Status already changed — skip product release
      // Only release active products — soft-deleted products (active=false)
      // were explicitly removed by admin and should stay deleted
      await tx.product.updateMany({
        where: { id: { in: productIds }, active: true, sold: true },
        data: { sold: false, stock: 1 },
      });
    });
  } else if (order.status === "cancelled" && status !== "cancelled") {
    // Un-cancelling: re-mark products as sold, but only if they haven't been
    // sold to a different order in the meantime (prevents double-sell).
    // Both check and update MUST be inside the same transaction to prevent
    // a TOCTOU race where a concurrent checkout sells the products between
    // the availability check and the update.
    await prisma.$transaction(async (tx) => {
      const alreadySold = await tx.product.findMany({
        where: { id: { in: productIds }, sold: true },
        select: { id: true, name: true },
      });

      if (alreadySold.length > 0) {
        const names = alreadySold.map((p) => p.name).join(", ");
        throw new Error(
          `Nelze obnovit objednávku — tyto produkty byly mezitím prodány v jiné objednávce: ${names}`
        );
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status },
      });
      const updated = await tx.product.updateMany({
        where: { id: { in: productIds }, sold: false },
        data: { sold: true, stock: 0 },
      });
      if (updated.count !== productIds.length) {
        throw new Error(
          "Některé produkty byly mezitím prodány — obnovení objednávky selhalo.",
        );
      }
    });
  } else {
    await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  }

  // Fire-and-forget status notification email (never blocks admin action)
  prisma.order
    .findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        accessToken: true,
        total: true,
        customer: { select: { firstName: true, lastName: true, email: true } },
      },
    })
    .then((o) => {
      if (!o || !o.customer.email) return;
      sendOrderStatusEmail(status, {
        orderNumber: o.orderNumber,
        customerName: `${o.customer.firstName} ${o.customer.lastName}`,
        customerEmail: o.customer.email,
        total: o.total,
        accessToken: o.accessToken ?? "",
      });
    })
    .catch((err) => {
      console.error(`[Email] Failed to fetch order for status email:`, err);
    });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/products");
  revalidatePath("/");
}

export async function updateTrackingNumber(orderId: string, trackingNumber: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const trimmed = trackingNumber.trim();

  await prisma.order.update({
    where: { id: orderId },
    data: { trackingNumber: trimmed || null },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}
