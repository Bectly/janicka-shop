"use server";

import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { rateLimitAdmin } from "@/lib/rate-limit";
import {
  generateCreditNotePdf,
  type CreditNoteData,
} from "@/lib/invoice/generate-credit-note";
import { RETURN_REASON_LABELS } from "@/lib/constants";
import { refundComgatePayment } from "@/lib/payments/comgate";
import { ComgateError } from "@/lib/payments/types";

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

    revalidateTag("products", "seconds");
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

/**
 * Generate sequential credit note number: DOP-YYYY-NNNN
 * Separate numbering from invoices (Czech accounting requirement).
 */
async function getNextCreditNoteNumber(
  db: Awaited<ReturnType<typeof getDb>>,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DOP-${year}-`;

  const latest = await db.creditNote.findFirst({
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
 * Generate a credit note PDF for a return and save it to the database.
 * Requires the original order to have an invoice.
 */
export async function generateCreditNote(
  returnId: string,
): Promise<{ creditNoteId: string; creditNoteNumber: string; pdfBase64: string }> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success)
    throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();

  // Check if credit note already exists for this return
  const existing = await db.creditNote.findFirst({
    where: { returnId },
    select: { id: true, number: true },
  });
  if (existing) {
    throw new Error(
      `Dobropis pro tuto vratku již existuje (${existing.number}).`,
    );
  }

  // Fetch return with all related data
  const returnRecord = await db.return.findUnique({
    where: { id: returnId },
    include: {
      customer: true,
      order: {
        include: {
          invoices: {
            orderBy: { createdAt: "desc" as const },
            take: 1,
            select: { number: true },
          },
        },
      },
      items: true,
    },
  });

  if (!returnRecord) throw new Error("Vratka nenalezena");

  // Get original invoice number
  const originalInvoice = returnRecord.order.invoices[0];
  if (!originalInvoice) {
    throw new Error(
      "Nelze vystavit dobropis — objednávka nemá fakturu. Nejprve vystavte fakturu.",
    );
  }

  // Fetch shop settings (seller info)
  let settings = await db.shopSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) {
    settings = await db.shopSettings.create({
      data: { id: "singleton" },
    });
  }

  const creditNoteNumber = await getNextCreditNoteNumber(db);
  const now = new Date();

  const creditNoteData: CreditNoteData = {
    creditNoteNumber,
    issuedAt: now,
    originalInvoiceNumber: originalInvoice.number,

    sellerName: settings.shopName || "Janička",
    sellerStreet: settings.street || "",
    sellerCity: settings.city || "",
    sellerZip: settings.zip || "",
    sellerIco: settings.ico || "",
    sellerDic: settings.dic || "",
    sellerEmail: settings.contactEmail || "",
    sellerPhone: settings.contactPhone || "",

    buyerName: `${returnRecord.customer.firstName} ${returnRecord.customer.lastName}`,
    buyerStreet: returnRecord.order.shippingStreet ?? returnRecord.customer.street ?? "",
    buyerCity: returnRecord.order.shippingCity ?? returnRecord.customer.city ?? "",
    buyerZip: returnRecord.order.shippingZip ?? returnRecord.customer.zip ?? "",
    buyerCountry: returnRecord.order.shippingCountry ?? returnRecord.customer.country ?? "CZ",
    buyerEmail: returnRecord.customer.email,

    returnNumber: returnRecord.returnNumber,
    returnReason:
      RETURN_REASON_LABELS[returnRecord.reason] ?? returnRecord.reason,

    items: returnRecord.items.map((item) => ({
      name: item.productName,
      quantity: 1,
      unitPrice: item.price,
      totalPrice: item.price,
      size: item.size,
    })),

    refundAmount: returnRecord.refundAmount,
  };

  const pdfBytes = generateCreditNotePdf(creditNoteData);
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  // Save credit note record to DB
  const creditNote = await db.creditNote.create({
    data: {
      returnId,
      number: creditNoteNumber,
      invoiceNumber: originalInvoice.number,
      issuedAt: now,
      totalAmount: -returnRecord.refundAmount,
    },
  });

  revalidatePath(`/admin/returns/${returnId}`);

  return {
    creditNoteId: creditNote.id,
    creditNoteNumber: creditNote.number,
    pdfBase64,
  };
}

/**
 * Trigger a refund on the Comgate payment gateway for a return.
 * Uses Order.paymentId (Comgate transId) to call Comgate /refund.
 * On success: records refundedAt + refundProcessedAmount on Return and
 * auto-transitions status to "completed" if currently "approved".
 */
export async function refundViaComgate(
  returnId: string,
  amountCzk?: number,
): Promise<{ refundedAmount: number }> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success)
    throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();

  const returnRecord = await db.return.findUnique({
    where: { id: returnId },
    include: {
      order: {
        select: { id: true, paymentId: true, paymentMethod: true, total: true },
      },
      items: { select: { productId: true } },
    },
  });

  if (!returnRecord) throw new Error("Vratka nenalezena");

  if (returnRecord.refundedAt) {
    throw new Error("Peníze již byly vráceny přes Comgate");
  }

  if (returnRecord.status === "rejected") {
    throw new Error("Vratka je zamítnutá — nelze vracet peníze");
  }

  const transId = returnRecord.order.paymentId;
  if (!transId) {
    throw new Error(
      "Objednávka nemá Comgate transId — platba nebyla zpracována přes Comgate",
    );
  }

  if (returnRecord.order.paymentMethod === "bank_transfer") {
    throw new Error(
      "Objednávka zaplacena převodem — peníze vraťte ručně ze svého účtu",
    );
  }

  const amount =
    amountCzk !== undefined && amountCzk > 0
      ? Math.min(amountCzk, returnRecord.refundAmount)
      : returnRecord.refundAmount;

  if (amount <= 0) {
    throw new Error("Neplatná částka k vrácení");
  }

  try {
    await refundComgatePayment(transId, amount);
  } catch (err) {
    if (err instanceof ComgateError) {
      throw new Error(`Comgate chyba ${err.code}: ${err.message}`);
    }
    throw err;
  }

  const now = new Date();
  const shouldComplete = returnRecord.status === "approved";
  const productIds = returnRecord.items.map((i) => i.productId);

  await db.$transaction(async (tx) => {
    await tx.return.update({
      where: { id: returnId },
      data: {
        refundedAt: now,
        refundProcessedAmount: amount,
        refundTransId: transId,
        refundMethod: "original_method",
        ...(shouldComplete
          ? { status: "completed", completedAt: now }
          : {}),
      },
    });
    if (shouldComplete) {
      await tx.product.updateMany({
        where: { id: { in: productIds }, active: true, sold: true },
        data: { sold: false, stock: 1 },
      });
    }
  });

  revalidatePath(`/admin/returns/${returnId}`);
  revalidatePath("/admin/returns");
  revalidatePath(`/admin/orders/${returnRecord.order.id}`);

  return { refundedAmount: amount };
}

/**
 * Regenerate and download an existing credit note PDF.
 */
export async function downloadCreditNote(
  creditNoteId: string,
): Promise<{ creditNoteNumber: string; pdfBase64: string }> {
  await requireAdmin();

  const db = await getDb();

  const creditNote = await db.creditNote.findUnique({
    where: { id: creditNoteId },
    include: {
      return: {
        include: {
          customer: true,
          order: true,
          items: true,
        },
      },
    },
  });

  if (!creditNote) throw new Error("Dobropis nenalezen");

  let settings = await db.shopSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) {
    settings = await db.shopSettings.create({ data: { id: "singleton" } });
  }

  const ret = creditNote.return;

  const creditNoteData: CreditNoteData = {
    creditNoteNumber: creditNote.number,
    issuedAt: creditNote.issuedAt,
    originalInvoiceNumber: creditNote.invoiceNumber,

    sellerName: settings.shopName || "Janička",
    sellerStreet: settings.street || "",
    sellerCity: settings.city || "",
    sellerZip: settings.zip || "",
    sellerIco: settings.ico || "",
    sellerDic: settings.dic || "",
    sellerEmail: settings.contactEmail || "",
    sellerPhone: settings.contactPhone || "",

    buyerName: `${ret.customer.firstName} ${ret.customer.lastName}`,
    buyerStreet: ret.order.shippingStreet ?? ret.customer.street ?? "",
    buyerCity: ret.order.shippingCity ?? ret.customer.city ?? "",
    buyerZip: ret.order.shippingZip ?? ret.customer.zip ?? "",
    buyerCountry: ret.order.shippingCountry ?? ret.customer.country ?? "CZ",
    buyerEmail: ret.customer.email,

    returnNumber: ret.returnNumber,
    returnReason: RETURN_REASON_LABELS[ret.reason] ?? ret.reason,

    items: ret.items.map((item) => ({
      name: item.productName,
      quantity: 1,
      unitPrice: item.price,
      totalPrice: item.price,
      size: item.size,
    })),

    refundAmount: ret.refundAmount,
  };

  const pdfBytes = generateCreditNotePdf(creditNoteData);
  const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

  return { creditNoteNumber: creditNote.number, pdfBase64 };
}
