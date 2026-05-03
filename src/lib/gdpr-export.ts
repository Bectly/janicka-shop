import { getDb } from "@/lib/db";

export interface ExportBundle {
  meta: {
    generatedAt: string;
    customerId: string;
    format: "janicka-gdpr-export-v1";
    docs: string;
  };
  profile: Record<string, unknown>;
  addresses: unknown[];
  orders: unknown[];
  returns: unknown[];
  wishlist: unknown[];
  newsletter: Record<string, unknown> | null;
  loginHistory: unknown[];
  priceWatches: unknown[];
}

/**
 * Assemble a GDPR Article 20 data bundle for a given customer.
 *
 * Administrative fields (admin internal notes, admin-managed tags) are excluded
 * — those are processing records, not personal data the customer originated.
 */
export async function buildCustomerDataBundle(
  customerId: string,
): Promise<ExportBundle> {
  const db = await getDb();

  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      street: true,
      city: true,
      zip: true,
      country: true,
      notifyMarketing: true,
      emailVerified: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!customer) throw new Error("customer_not_found");

  const [
    addresses,
    orders,
    returns,
    wishlist,
    loginHistory,
    newsletter,
    priceWatches,
  ] = await Promise.all([
      db.customerAddress.findMany({
        where: { customerId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          label: true,
          firstName: true,
          lastName: true,
          street: true,
          city: true,
          zip: true,
          country: true,
          phone: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.order.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentMethod: true,
          subtotal: true,
          shipping: true,
          total: true,
          note: true,
          shippingName: true,
          shippingStreet: true,
          shippingCity: true,
          shippingZip: true,
          shippingCountry: true,
          shippingMethod: true,
          shippingPointId: true,
          trackingNumber: true,
          shippedAt: true,
          expectedDeliveryDate: true,
          createdAt: true,
          updatedAt: true,
          items: {
            select: {
              name: true,
              price: true,
              quantity: true,
              size: true,
              color: true,
            },
          },
        },
      }),
      db.return.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        select: {
          returnNumber: true,
          status: true,
          reason: true,
          reasonDetail: true,
          refundAmount: true,
          refundMethod: true,
          createdAt: true,
          resolvedAt: true,
          completedAt: true,
          items: {
            select: {
              productName: true,
              price: true,
              size: true,
              color: true,
            },
          },
        },
      }),
      db.customerWishlist.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          product: {
            select: { id: true, name: true, slug: true, sku: true },
          },
        },
      }),
      db.customerAuditLog.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          action: true,
          ip: true,
          userAgent: true,
          metadata: true,
          createdAt: true,
        },
      }),
      db.newsletterSubscriber.findFirst({
        where: { email: customer.email.toLowerCase() },
        select: {
          active: true,
          firstName: true,
          preferredSizes: true,
          preferredCategories: true,
          preferredBrands: true,
          source: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.priceWatch.findMany({
        where: { email: customer.email.toLowerCase() },
        select: {
          productId: true,
          currentPrice: true,
          createdAt: true,
        },
      }),
    ]);

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      customerId,
      format: "janicka-gdpr-export-v1",
      docs: "https://www.jvsatnik.cz/privacy",
    },
    profile: customer,
    addresses,
    orders,
    returns,
    wishlist: wishlist.map((w) => ({
      productId: w.product?.id,
      productName: w.product?.name,
      productSlug: w.product?.slug,
      productSku: w.product?.sku,
      addedAt: w.createdAt,
    })),
    newsletter: newsletter
      ? {
          ...newsletter,
          preferredSizes: safeJsonParse(newsletter.preferredSizes),
          preferredCategories: safeJsonParse(newsletter.preferredCategories),
          preferredBrands: safeJsonParse(newsletter.preferredBrands),
        }
      : null,
    loginHistory: loginHistory.map((l) => ({
      action: l.action,
      ip: l.ip,
      userAgent: l.userAgent,
      metadata: safeJsonParse(l.metadata),
      at: l.createdAt,
    })),
    priceWatches,
  };
}

function safeJsonParse(raw: string | null | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
