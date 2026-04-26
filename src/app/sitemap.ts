import type { MetadataRoute } from "next";
import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";
import { getSiteUrl } from "@/lib/site-url";

const BASE_URL = getSiteUrl();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    {
      url: `${BASE_URL}/products`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.4 },
    {
      url: `${BASE_URL}/shipping`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    { url: `${BASE_URL}/terms`, changeFrequency: "monthly", priority: 0.3 },
    {
      url: `${BASE_URL}/privacy`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/returns`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/collections`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // Use a short-lived, isolated client so the engine process is fully
  // torn down before returning — prevents HANGING_PROMISE_REJECTION from
  // Prisma's query engine contaminating other build workers.
  const db = new PrismaClient();
  try {
    const [activeProducts, soldProducts, categories, collections] = await Promise.all([
      db.product.findMany({
        where: { active: true, sold: false },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      // Sold products still have valid pages (show "Prodáno" + similar items).
      // Including them helps SEO — users find them via Google, see alternatives.
      db.product.findMany({
        where: { active: true, sold: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      db.category.findMany({
        select: { slug: true, updatedAt: true },
      }),
      db.collection.findMany({
        where: {
          active: true,
          // Only include collections currently visible to users (respecting startDate/endDate)
          OR: [{ startDate: null }, { startDate: { lte: new Date() } }],
          AND: [{ OR: [{ endDate: null }, { endDate: { gte: new Date() } }] }],
        },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
      url: `${BASE_URL}/products?category=${cat.slug}`,
      lastModified: cat.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const activeProductPages: MetadataRoute.Sitemap = activeProducts.map((product) => ({
      url: `${BASE_URL}/products/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    const soldProductPages: MetadataRoute.Sitemap = soldProducts.map((product) => ({
      url: `${BASE_URL}/products/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "monthly",
      priority: 0.3,
    }));

    const collectionPages: MetadataRoute.Sitemap = collections.map((c) => ({
      url: `${BASE_URL}/collections/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...staticPages, ...categoryPages, ...collectionPages, ...activeProductPages, ...soldProductPages];
  } catch {
    logger.error("[Sitemap] DB query failed, returning static pages only");
    return staticPages;
  } finally {
    // Explicitly disconnect to resolve Prisma engine's internal promises
    // before this build worker finishes — prevents contaminating other workers.
    await db.$disconnect().catch(() => {});
  }
}
