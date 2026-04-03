"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

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
  if (status === "cancelled" && order.status !== "cancelled") {
    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { status },
      }),
      prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { sold: false, stock: 1 },
      }),
    ]);
  } else if (order.status === "cancelled" && status !== "cancelled") {
    // Un-cancelling: re-mark products as sold, but only if they haven't been
    // sold to a different order in the meantime (prevents double-sell)
    const alreadySold = await prisma.product.findMany({
      where: { id: { in: productIds }, sold: true },
      select: { id: true, name: true },
    });

    if (alreadySold.length > 0) {
      const names = alreadySold.map((p) => p.name).join(", ");
      throw new Error(
        `Nelze obnovit objednávku — tyto produkty byly mezitím prodány v jiné objednávce: ${names}`
      );
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: { status },
      }),
      prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { sold: true, stock: 0 },
      }),
    ]);
  } else {
    await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/products");
  revalidatePath("/");
}
