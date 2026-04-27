import { describe, it, expect } from "vitest";
import {
  grossProfit,
  marginPct,
  bundleROI,
  conversionRate,
  isStale,
  avgDaysToSell,
} from "@/lib/cost-basis";

describe("cost-basis math", () => {
  it("grossProfit: price=200 + costBasis=85 → 115", () => {
    expect(grossProfit(200, 85)).toBe(115);
  });

  it("marginPct: grossProfit/price → 57.5%", () => {
    expect(marginPct(200, 85)).toBeCloseTo(57.5, 5);
  });

  it("bundleROI: sumSold=5000, totalCost=2000 → 150%", () => {
    expect(bundleROI(5000, 2000)).toBe(150);
  });

  it("conversionRate: sold=15, total=60 → 25%", () => {
    expect(conversionRate(15, 60)).toBe(25);
  });

  it("isStale: createdAt 91 days ago + threshold 90 → true", () => {
    const now = new Date("2026-04-27T00:00:00Z");
    const createdAt = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000);
    expect(isStale(createdAt, now, 90)).toBe(true);

    const fresh = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(isStale(fresh, now, 90)).toBe(false);
  });

  it("avgDaysToSell: averages soldAt - createdAt across products", () => {
    const base = new Date("2026-01-01T00:00:00Z");
    const days = (n: number) => new Date(base.getTime() + n * 86_400_000);
    const products = [
      { createdAt: base, soldAt: days(10) },
      { createdAt: base, soldAt: days(20) },
      { createdAt: base, soldAt: days(30) },
      { createdAt: base, soldAt: null },
    ];
    expect(avgDaysToSell(products)).toBe(20);
  });
});
