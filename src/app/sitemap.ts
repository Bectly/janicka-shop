import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

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
  ];

  // Graceful degradation: if DB is unavailable (Turso cold start, network error),
  // return static pages only so crawlers don't get a 500 on /sitemap.xml
  try {
    const [activeProducts, soldProducts, categories] = await Promise.all([
      prisma.product.findMany({
        where: { active: true, sold: false },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      // Sold products still have valid pages (show "Prodáno" + similar items).
      // Including them helps SEO — users find them via Google, see alternatives.
      prisma.product.findMany({
        where: { active: true, sold: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.category.findMany({
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

    return [...staticPages, ...categoryPages, ...activeProductPages, ...soldProductPages];
  } catch {
    console.error("[Sitemap] DB query failed, returning static pages only");
    return staticPages;
  }
}
