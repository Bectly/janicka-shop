import { prisma } from "@/lib/db";

/**
 * Get the lowest price from the last 30 days for the given product IDs.
 * Considers both PriceHistory entries and the products' current prices.
 * Returns a Map of productId → lowestPrice (only for products that have history).
 *
 * Czech "fake discount" law (Omnibus Directive) requires displaying the lowest
 * price from the previous 30 days whenever a price reduction is advertised.
 */
export async function getLowestPrices30d(
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const histories = await prisma.priceHistory.findMany({
    where: {
      productId: { in: productIds },
      changedAt: { gte: thirtyDaysAgo },
    },
    select: { productId: true, price: true },
  });

  // Group by productId and find minimum price
  const result = new Map<string, number>();
  for (const h of histories) {
    const current = result.get(h.productId);
    if (current === undefined || h.price < current) {
      result.set(h.productId, h.price);
    }
  }

  return result;
}
