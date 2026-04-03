import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, sold: false },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.category.findMany({
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    {
      url: `${BASE_URL}/products`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/search`,
      changeFrequency: "weekly",
      priority: 0.5,
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

  const categoryPages: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${BASE_URL}/products?category=${cat.slug}`,
    lastModified: cat.updatedAt,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${BASE_URL}/products/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...productPages];
}
