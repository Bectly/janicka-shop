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
        trackingNumber: true,
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
        trackingNumber: o.trackingNumber,
      }).catch((err: unknown) => {
        console.error(`[Email] Failed to send order status email:`, err);
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

/** Escape a CSV field: wrap in quotes if it contains comma, quote, or newline.
 *  Prevents CSV formula injection by prefixing cells starting with =, +, -, @, \t, \r
 *  with a single quote (Excel text indicator — suppresses formula execution). */
function csvField(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  const needsFormulaGuard =
    str.length > 0 &&
    (str[0] === "=" ||
      str[0] === "+" ||
      str[0] === "-" ||
      str[0] === "@" ||
      str[0] === "\t" ||
      str[0] === "\r");
  const safe = needsFormulaGuard ? "'" + str : str;
  if (
    safe.includes(",") ||
    safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r")
  ) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export async function exportOrdersCsv(statusFilter?: string): Promise<string> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const where: Record<string, unknown> = {};
  if (statusFilter && statusFilter !== "all" && VALID_STATUSES.includes(statusFilter)) {
    where.status = statusFilter;
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: {
      customer: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
      items: { select: { name: true, price: true, size: true, color: true } },
    },
  });

  const header = [
    "Číslo objednávky",
    "Datum",
    "Jméno",
    "Email",
    "Telefon",
    "Položky",
    "Mezisoučet",
    "Doprava",
    "Celkem",
    "Status",
    "Platba",
    "Doprava (způsob)",
    "Sledovací číslo",
  ];

  const rows = orders.map((o) => {
    const itemsSummary = o.items
      .map((i) => `${i.name}${i.size ? ` (${i.size})` : ""}`)
      .join("; ");
    const date = new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).format(o.createdAt);

    return [
      o.orderNumber,
      date,
      `${o.customer.firstName} ${o.customer.lastName}`,
      o.customer.email,
      o.customer.phone ?? "",
      itemsSummary,
      o.subtotal,
      o.shipping,
      o.total,
      ORDER_STATUS_LABELS[o.status] ?? o.status,
      o.paymentMethod ?? "",
      o.shippingMethod ?? "",
      o.trackingNumber ?? "",
    ];
  });

  const csv =
    header.map(csvField).join(",") +
    "\n" +
    rows.map((row) => row.map(csvField).join(",")).join("\n");

  // BOM for Excel UTF-8 recognition
  return "\uFEFF" + csv;
}

export async function updateTrackingNumber(orderId: string, trackingNumber: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  // Validate input length — tracking numbers are typically 10-30 chars
  const trimmed = trackingNumber.trim().slice(0, 100);

  await prisma.order.update({
    where: { id: orderId },
    data: { trackingNumber: trimmed || null },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}
