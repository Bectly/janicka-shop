import { getDb } from "@/lib/db";
import { cacheLife, cacheTag } from "next/cache";

const REVENUE_STATUSES = ["paid", "shipped", "delivered"] as const;
type AnalyticsWindow = 30 | 90;

export interface TopProduct {
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  soldCount: number;
  revenue: number;
}

export interface CategorySale {
  categoryId: string;
  name: string;
  revenue: number;
  count: number;
}

export interface StaleProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  createdAt: Date;
  categoryName: string;
  image: string | null;
}

export interface MonthlyRevenue {
  month: string;       // "2026-04"
  label: string;       // "duben 26"
  revenue: number;
  orderCount: number;
}

function firstImage(raw: string): string | null {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) && typeof v[0] === "string" ? v[0] : null;
  } catch {
    return null;
  }
}

export async function getTopProducts(windowDays: AnalyticsWindow): Promise<TopProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("orders");
  cacheTag("products");
  try {
    const db = await getDb();
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const items = await db.orderItem.findMany({
      where: {
        order: {
          status: { in: [...REVENUE_STATUSES] },
          createdAt: { gte: since },
        },
      },
      include: {
        product: { select: { id: true, name: true, slug: true, images: true } },
      },
    });

    const agg = new Map<string, TopProduct>();
    for (const it of items) {
      const key = it.productId;
      const existing = agg.get(key);
      const revenue = it.price * it.quantity;
      if (existing) {
        existing.soldCount += it.quantity;
        existing.revenue += revenue;
      } else {
        agg.set(key, {
          productId: key,
          name: it.product.name,
          slug: it.product.slug,
          image: firstImage(it.product.images),
          soldCount: it.quantity,
          revenue,
        });
      }
    }

    return Array.from(agg.values())
      .sort((a, b) => b.soldCount - a.soldCount || b.revenue - a.revenue)
      .slice(0, 10);
  } catch {
    return [];
  }
}

export async function getCategorySales(windowDays: AnalyticsWindow): Promise<CategorySale[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("orders");
  cacheTag("products");
  try {
    const db = await getDb();
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const items = await db.orderItem.findMany({
      where: {
        order: {
          status: { in: [...REVENUE_STATUSES] },
          createdAt: { gte: since },
        },
      },
      include: {
        product: {
          select: {
            categoryId: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    const agg = new Map<string, CategorySale>();
    for (const it of items) {
      const cid = it.product.categoryId;
      const existing = agg.get(cid);
      const revenue = it.price * it.quantity;
      if (existing) {
        existing.revenue += revenue;
        existing.count += it.quantity;
      } else {
        agg.set(cid, {
          categoryId: cid,
          name: it.product.category.name,
          revenue,
          count: it.quantity,
        });
      }
    }

    return Array.from(agg.values()).sort((a, b) => b.revenue - a.revenue);
  } catch {
    return [];
  }
}

export async function getStaleProducts(): Promise<StaleProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  cacheTag("orders");
  try {
    const db = await getDb();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const candidates = await db.product.findMany({
      where: {
        active: true,
        sold: false,
        createdAt: { lt: sixtyDaysAgo },
        orderItems: { none: {} },
      },
      orderBy: { price: "desc" },
      take: 20,
      include: { category: { select: { name: true } } },
    });

    return candidates.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      createdAt: p.createdAt,
      categoryName: p.category.name,
      image: firstImage(p.images),
    }));
  } catch {
    return [];
  }
}

const CZECH_MONTHS = [
  "led", "úno", "bře", "dub", "kvě", "čer",
  "črc", "srp", "zář", "říj", "lis", "pro",
];

export async function getMonthlyRevenue(): Promise<MonthlyRevenue[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("orders");
  try {
    const db = await getDb();
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const orders = await db.order.findMany({
      where: {
        status: { in: [...REVENUE_STATUSES] },
        createdAt: { gte: twelveMonthsAgo },
      },
      select: { createdAt: true, total: true },
    });

    // Build buckets for every month in range (include empty months)
    const buckets = new Map<string, { revenue: number; orderCount: number }>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, { revenue: 0, orderCount: 0 });
    }

    for (const o of orders) {
      const d = o.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = buckets.get(key);
      if (b) {
        b.revenue += o.total;
        b.orderCount += 1;
      }
    }

    return Array.from(buckets.entries()).map(([month, { revenue, orderCount }]) => {
      const [y, m] = month.split("-");
      const monthIdx = parseInt(m, 10) - 1;
      const label = `${CZECH_MONTHS[monthIdx]} ${y.slice(2)}`;
      return { month, label, revenue, orderCount };
    });
  } catch {
    return [];
  }
}
