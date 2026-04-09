"use server";

import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, SHIPPING_METHOD_LABELS } from "@/lib/constants";
import { sendOrderStatusEmail, sendShippingNotificationEmail } from "@/lib/email";
import { rateLimitAdmin } from "@/lib/rate-limit";
import { generateInvoicePdf, type InvoiceData } from "@/lib/invoice/generate-invoice";
import { createPacket, getPacketLabel } from "@/lib/shipping/packeta";

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

  const db = await getDb();

  const order = await db.order.findUnique({
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
    await db.$transaction(async (tx) => {
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
    await db.$transaction(async (tx) => {
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
    await db.order.update({
      where: { id: orderId },
      data: {
        status,
        // Record shipping timestamp when order transitions to shipped
        ...(status === "shipped" ? { shippedAt: new Date() } : {}),
      },
    });
  }

  // Fire-and-forget status notification email (never blocks admin action)
  if (status === "shipped") {
    // Enhanced shipping email with cross-sell product recommendations
    sendShippingEmailWithCrossSell(db, orderId).catch((err) => {
      console.error("[Email] Failed to send shipping notification:", err);
    });
  } else {
    db.order
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
  }

  revalidateTag("products", "seconds");
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

  const db = await getDb();

  const orders = await db.order.findMany({
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

/**
 * Fetch order data + cross-sell product recommendations, then send enhanced shipping email.
 * Cross-sell: same category + matching sizes from live (unsold) inventory, max 4 products.
 */
async function sendShippingEmailWithCrossSell(
  db: Awaited<ReturnType<typeof getDb>>,
  orderId: string,
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      accessToken: true,
      total: true,
      trackingNumber: true,
      customer: { select: { firstName: true, lastName: true, email: true } },
      items: {
        select: {
          name: true,
          price: true,
          size: true,
          color: true,
          productId: true,
          product: { select: { categoryId: true, sizes: true } },
        },
      },
    },
  });

  if (!order || !order.customer.email) return;

  // Gather category IDs and sizes from ordered items for cross-sell matching
  const categoryIds = [...new Set(order.items.map((i) => i.product.categoryId))];
  const orderedSizes = [
    ...new Set(order.items.filter((i) => i.size).map((i) => i.size!)),
  ];
  const orderedProductIds = order.items.map((i) => i.productId);

  // Fetch candidate products from same categories (more than needed for size filtering)
  const candidates = await db.product.findMany({
    where: {
      categoryId: { in: categoryIds },
      id: { notIn: orderedProductIds },
      active: true,
      sold: false,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      name: true,
      slug: true,
      price: true,
      compareAt: true,
      brand: true,
      condition: true,
      images: true,
      sizes: true,
    },
  });

  // Score candidates: prefer size overlap, then recency (already sorted by createdAt desc)
  // Guard against malformed JSON in sizes/images columns (stored as plain String in Prisma)
  const scored = candidates.map((p) => {
    let parsedSizes: string[] = [];
    try { parsedSizes = JSON.parse(p.sizes) as string[]; } catch { /* treat as no sizes */ }
    const sizeMatch =
      orderedSizes.length > 0 && parsedSizes.some((s) => orderedSizes.includes(s));
    return { ...p, sizeMatch, parsedSizes };
  });

  // Size-matched first, then rest — take top 4
  const sizeMatched = scored.filter((p) => p.sizeMatch);
  const rest = scored.filter((p) => !p.sizeMatch);
  const selected = [...sizeMatched, ...rest].slice(0, 4);

  const crossSellProducts = selected.map((p) => {
    let images: string[] = [];
    try { images = JSON.parse(p.images) as string[]; } catch { /* no images */ }
    return {
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAt: p.compareAt,
      brand: p.brand,
      condition: p.condition,
      image: images[0] ?? null,
      sizes: p.parsedSizes,
    };
  });

  await sendShippingNotificationEmail({
    orderNumber: order.orderNumber,
    customerName: `${order.customer.firstName} ${order.customer.lastName}`,
    customerEmail: order.customer.email,
    total: order.total,
    accessToken: order.accessToken ?? "",
    trackingNumber: order.trackingNumber,
    items: order.items.map((i) => ({
      name: i.name,
      price: i.price,
      size: i.size,
      color: i.color,
    })),
    crossSellProducts,
  });
}

export async function updateTrackingNumber(orderId: string, trackingNumber: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  // Validate input length — tracking numbers are typically 10-30 chars
  const trimmed = trackingNumber.trim().slice(0, 100);

  const db = await getDb();

  await db.order.update({
    where: { id: orderId },
    data: { trackingNumber: trimmed || null },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

/**
 * Generate a sequential invoice number: JAN-YYYY-NNNN
 * Sequential within the current year, zero-padded to 4 digits.
 */
async function getNextInvoiceNumber(
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JAN-${year}-`;

  // Find the highest invoice number for the current year
  const latest = await db.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  let seq = 1;
  if (latest) {
    const lastSeq = parseInt(latest.number.replace(prefix, ""), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Generate an invoice PDF for an order and save it to the database.
 * Returns the invoice ID and PDF bytes as base64.
 */
export async function generateInvoice(
  orderId: string,
): Promise<{ invoiceId: string; invoiceNumber: string; pdfBase64: string }> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success)
    throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();

  // Check if invoice already exists
  const existing = await db.invoice.findFirst({
    where: { orderId },
    select: { id: true, number: true },
  });
  if (existing) {
    throw new Error(
      `Faktura pro tuto objednávku již existuje (${existing.number}).`,
    );
  }

  // Fetch order with all related data
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: {
        include: {
          product: { select: { brand: true, condition: true } },
        },
      },
    },
  });

  if (!order) throw new Error("Objednávka nenalezena");

  // Fetch shop settings (seller info)
  let settings = await db.shopSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) {
    // Create default settings if not found
    settings = await db.shopSettings.create({
      data: { id: "singleton" },
    });
  }

  const invoiceNumber = await getNextInvoiceNumber(db);

  const now = new Date();
  // DUZP = date of taxable event. For paid orders, use payment date (createdAt of status change).
  // For simplicity, use order creation date as DUZP.
  const taxableEventDate = order.createdAt;

  const invoiceData: InvoiceData = {
    invoiceNumber,
    issuedAt: now,
    taxableEventDate,

    sellerName: settings.shopName || "Janička",
    sellerStreet: settings.street || "",
    sellerCity: settings.city || "",
    sellerZip: settings.zip || "",
    sellerIco: settings.ico || "",
    sellerDic: settings.dic || "",
    sellerEmail: settings.contactEmail || "",
    sellerPhone: settings.contactPhone || "",

    buyerName: `${order.customer.firstName} ${order.customer.lastName}`,
    buyerStreet: order.shippingStreet ?? order.customer.street ?? "",
    buyerCity: order.shippingCity ?? order.customer.city ?? "",
    buyerZip: order.shippingZip ?? order.customer.zip ?? "",
    buyerCountry: order.shippingCountry ?? order.customer.country ?? "CZ",
    buyerEmail: order.customer.email,

    orderNumber: order.orderNumber,
    paymentMethod:
      PAYMENT_METHOD_LABELS[order.paymentMethod ?? ""] ??
      order.paymentMethod ??
      "Neurčen",

    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
      size: item.size,
    })),

    subtotal: order.subtotal,
    shipping: order.shipping,
    shippingLabel:
      SHIPPING_METHOD_LABELS[order.shippingMethod ?? ""] ??
      order.shippingMethod ??
      "Standardní doručení",
    total: order.total,
  };

  const pdfBytes = generateInvoicePdf(invoiceData);
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  // Save invoice record to DB
  const invoice = await db.invoice.create({
    data: {
      orderId,
      number: invoiceNumber,
      issuedAt: now,
      totalAmount: order.total,
      // pdfUrl left null — PDF is generated on-demand from DB data
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.number,
    pdfBase64,
  };
}

/**
 * Regenerate and download an existing invoice PDF.
 * Does NOT create a new invoice — re-renders the PDF from order data.
 */
export async function downloadInvoice(
  invoiceId: string,
): Promise<{ invoiceNumber: string; pdfBase64: string }> {
  await requireAdmin();

  const db = await getDb();

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      order: {
        include: {
          customer: true,
          items: {
            include: {
              product: { select: { brand: true, condition: true } },
            },
          },
        },
      },
    },
  });

  if (!invoice) throw new Error("Faktura nenalezena");

  const order = invoice.order;
  let settings = await db.shopSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) {
    settings = await db.shopSettings.create({ data: { id: "singleton" } });
  }

  const invoiceData: InvoiceData = {
    invoiceNumber: invoice.number,
    issuedAt: invoice.issuedAt,
    taxableEventDate: order.createdAt,

    sellerName: settings.shopName || "Janička",
    sellerStreet: settings.street || "",
    sellerCity: settings.city || "",
    sellerZip: settings.zip || "",
    sellerIco: settings.ico || "",
    sellerDic: settings.dic || "",
    sellerEmail: settings.contactEmail || "",
    sellerPhone: settings.contactPhone || "",

    buyerName: `${order.customer.firstName} ${order.customer.lastName}`,
    buyerStreet: order.shippingStreet ?? order.customer.street ?? "",
    buyerCity: order.shippingCity ?? order.customer.city ?? "",
    buyerZip: order.shippingZip ?? order.customer.zip ?? "",
    buyerCountry: order.shippingCountry ?? order.customer.country ?? "CZ",
    buyerEmail: order.customer.email,

    orderNumber: order.orderNumber,
    paymentMethod:
      PAYMENT_METHOD_LABELS[order.paymentMethod ?? ""] ??
      order.paymentMethod ??
      "Neurčen",

    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      totalPrice: item.price * item.quantity,
      size: item.size,
    })),

    subtotal: order.subtotal,
    shipping: order.shipping,
    shippingLabel:
      SHIPPING_METHOD_LABELS[order.shippingMethod ?? ""] ??
      order.shippingMethod ??
      "Standardní doručení",
    total: order.total,
  };

  const pdfBytes = generateInvoicePdf(invoiceData);
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  return { invoiceNumber: invoice.number, pdfBase64 };
}

/**
 * Create a Packeta shipment for an order.
 * Requires: shippingMethod starts with "packeta", shippingPointId set, no packetId yet.
 * Stores the returned packetId on the order.
 */
export async function createPacketaShipment(
  orderId: string,
): Promise<{ packetId: string }> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      packetId: true,
      shippingMethod: true,
      shippingPointId: true,
      total: true,
      customer: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
    },
  });

  if (!order) throw new Error("Objednávka nenalezena");

  if (!order.shippingMethod?.startsWith("packeta")) {
    throw new Error("Objednávka nemá zvolenou dopravu přes Packetu");
  }

  if (!order.shippingPointId) {
    throw new Error("Objednávka nemá zvolené výdejní místo");
  }

  if (order.packetId) {
    throw new Error(`Zásilka již existuje (ID: ${order.packetId})`);
  }

  const packetId = await createPacket({
    number: order.orderNumber,
    name: order.customer.firstName,
    surname: order.customer.lastName,
    email: order.customer.email || undefined,
    phone: order.customer.phone || undefined,
    value: order.total,
    weight: 0.5, // Default for clothing
    addressId: order.shippingPointId,
    eshop: "Janička",
  });

  await db.order.update({
    where: { id: orderId },
    data: { packetId },
  });

  revalidatePath(`/admin/orders/${orderId}`);

  return { packetId };
}

/**
 * Download a Packeta shipping label PDF for an order.
 * Returns base64-encoded PDF.
 */
export async function downloadPacketaLabel(
  orderId: string,
): Promise<{ pdfBase64: string; packetId: string }> {
  await requireAdmin();

  const db = await getDb();

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { packetId: true },
  });

  if (!order) throw new Error("Objednávka nenalezena");
  if (!order.packetId) throw new Error("Objednávka nemá vytvořenou zásilku v Packetě");

  const pdfBase64 = await getPacketLabel(order.packetId);

  return { pdfBase64, packetId: order.packetId };
}
