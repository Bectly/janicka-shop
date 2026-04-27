export function grossProfit(price: number, costBasis: number): number {
  return price - costBasis;
}

export function marginPct(price: number, costBasis: number): number {
  if (price === 0) return 0;
  return (grossProfit(price, costBasis) / price) * 100;
}

export function bundleROI(sumSoldPrices: number, totalBundleCost: number): number {
  if (totalBundleCost === 0) return 0;
  return ((sumSoldPrices - totalBundleCost) / totalBundleCost) * 100;
}

export function conversionRate(soldCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  return (soldCount / totalCount) * 100;
}

export function isStale(
  createdAt: Date,
  now: Date = new Date(),
  thresholdDays = 90,
): boolean {
  const diffMs = now.getTime() - createdAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= thresholdDays;
}

export function avgDaysToSell(
  products: { createdAt: Date; soldAt: Date | null }[],
): number {
  const sold = products.filter(
    (p): p is { createdAt: Date; soldAt: Date } => p.soldAt !== null,
  );
  if (sold.length === 0) return 0;
  const totalDays = sold.reduce((acc, p) => {
    const diffMs = p.soldAt.getTime() - p.createdAt.getTime();
    return acc + diffMs / (1000 * 60 * 60 * 24);
  }, 0);
  return totalDays / sold.length;
}
