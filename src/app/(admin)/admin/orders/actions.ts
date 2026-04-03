"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const VALID_STATUSES = [
  "pending",
  "confirmed",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
];

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
    // Un-cancelling: re-mark products as sold to prevent double-sell
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
