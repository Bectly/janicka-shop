"use server";

import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { rateLimitAdmin } from "@/lib/rate-limit";

const VALID_STATUSES = ["pending", "approved", "rejected", "completed"];
const VALID_REASONS = ["withdrawal_14d", "defect", "wrong_item", "other"];

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

/**
 * Generate sequential return number: VRT-YYYY-NNNN
 */
async function getNextReturnNumber(
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `VRT-${year}-`;

  const latest = await db.return.findFirst({
    where: { returnNumber: { startsWith: prefix } },
    orderBy: { returnNumber: "desc" },
    select: { returnNumber: true },
  });

  let seq = 1;
  if (latest) {
    const lastSeq = parseInt(latest.returnNumber.replace(prefix, ""), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Create a new return request from an order.
 */
export async function createReturn(data: {
  orderId: string;
  reason: string;
  reasonDetail?: string;
  refundAmount: number;
  itemIds: string[]; // orderItem IDs to return
}) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  if (!VALID_REASONS.includes(data.reason)) {
    throw new Error("Neplatný důvod vratky");
  }

  if (data.refundAmount <= 0) {
    throw new Error("Částka k vrácení musí být kladná");
  }

  if (data.itemIds.length === 0) {
    throw new Error("Vyberte alespoň jednu položku k vrácení");
  }

  const db = await getDb();

  const order = await db.order.findUnique({
    where: { id: data.orderId },
    include: {
      customer: { select: { id: true } },
      items: {
        include: {
          product: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!order) throw new Error("Objednávka nenalezena");

  // Validate selected items belong to this order
  const orderItemIds = new Set(order.items.map((i) => i.id));
  for (const itemId of data.itemIds) {
    if (!orderItemIds.has(itemId)) {
      throw new Error("Neplatná položka objednávky");
    }
  }

  // Validate refund doesn't exceed order total
  if (data.refundAmount > order.total) {
    throw new Error("Částka k vrácení nesmí převyšovat celkovou cenu objednávky");
  }

  const returnNumber = await getNextReturnNumber(db);
  const selectedItems = order.items.filter((i) => data.itemIds.includes(i.id));

  const returnRecord = await db.return.create({
    data: {
      returnNumber,
      orderId: data.orderId,
      customerId: order.customerId,
      reason: data.reason,
      reasonDetail: data.reasonDetail?.trim() || null,
      refundAmount: data.refundAmount,
      items: {
        create: selectedItems.map((item) => ({
          orderItemId: item.id,
          productId: item.productId,
          productName: item.name,
          price: item.price,
          size: item.size,
          color: item.color,
        })),
      },
    },
  });

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/orders/${data.orderId}`);

  return { returnId: returnRecord.id, returnNumber };
}

/**
 * Update return status with validation.
 */
export async function updateReturnStatus(
  returnId: string,
  status: string,
  adminNote?: string,
) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Neplatný status vratky");
  }

  const db = await getDb();

  const returnRecord = await db.return.findUnique({
    where: { id: returnId },
    include: {
      items: { select: { productId: true } },
    },
  });

  if (!returnRecord) throw new Error("Vratka nenalezena");

  const now = new Date();
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: now,
  };

  if (adminNote !== undefined) {
    updateData.adminNote = adminNote.trim() || null;
  }

  if (status === "approved" || status === "rejected") {
    updateData.resolvedAt = now;
  }

  if (status === "completed") {
    updateData.completedAt = now;
    // Release products back to catalog when return is completed
    // (second-hand: returned item becomes available again)
    const productIds = returnRecord.items.map((i) => i.productId);
    await db.$transaction(async (tx) => {
      await tx.return.update({
        where: { id: returnId },
        data: updateData,
      });
      await tx.product.updateMany({
        where: { id: { in: productIds }, active: true, sold: true },
        data: { sold: false, stock: 1 },
      });
    });

    revalidatePath("/admin/returns");
    revalidatePath(`/admin/returns/${returnId}`);
    revalidatePath(`/admin/orders/${returnRecord.orderId}`);
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return;
  }

  await db.return.update({
    where: { id: returnId },
    data: updateData,
  });

  revalidatePath("/admin/returns");
  revalidatePath(`/admin/returns/${returnId}`);
  revalidatePath(`/admin/orders/${returnRecord.orderId}`);
}
