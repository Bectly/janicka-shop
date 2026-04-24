"use server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { rateLimitAdmin } from "@/lib/rate-limit";
import { renderCampaignEmailPreview, sendCampaignEmail } from "@/lib/email";
import type { CampaignEmailData, CampaignProduct } from "@/lib/email";
import { getImageUrls, parseJsonStringArray } from "@/lib/images";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

function buildCampaignData(formData: FormData, products: CampaignProduct[]): CampaignEmailData {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const bodyText = (formData.get("bodyText") as string)?.trim() ?? "";
  return {
    subject: (formData.get("subject") as string)?.trim() ?? "",
    previewText: (formData.get("previewText") as string)?.trim() ?? "",
    heading: (formData.get("heading") as string)?.trim() ?? "",
    bodyHtml: bodyText
      ? bodyText
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br/>")
      : "",
    ctaText: (formData.get("ctaText") as string)?.trim() || "Prohlédnout",
    ctaUrl:
      (formData.get("ctaUrl") as string)?.trim() ||
      `${baseUrl}/products?sort=newest`,
    products,
  };
}

async function loadCollectionProducts(collectionId: string | null): Promise<CampaignProduct[]> {
  if (!collectionId) return [];
  const db = await getDb();
  const collection = await db.collection.findUnique({
    where: { id: collectionId },
    select: { productIds: true },
  });
  if (!collection) return [];
  const ids = parseJsonStringArray(collection.productIds);
  if (!ids.length) return [];
  const dbProducts = await db.product.findMany({
    where: { id: { in: ids }, active: true, sold: false },
    select: {
      name: true,
      slug: true,
      price: true,
      compareAt: true,
      brand: true,
      condition: true,
      images: true,
    },
    take: 8,
  });
  return dbProducts.map((p) => ({
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAt: p.compareAt,
    brand: p.brand,
    condition: p.condition,
    image: getImageUrls(p.images)[0] ?? null,
  }));
}

export async function getCollectionsForEditor() {
  await requireAdmin();
  const db = await getDb();
  const collections = await db.collection.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, productIds: true },
  });
  return collections.map((c) => ({
    id: c.id,
    title: c.title,
    productCount: parseJsonStringArray(c.productIds).length,
  }));
}

export async function previewCampaignEmail(formData: FormData): Promise<{
  html: string;
  subject: string;
  subscriberCount: number;
}> {
  const session = await requireAdmin();
  const collectionId = (formData.get("collectionId") as string) || null;
  const products = await loadCollectionProducts(collectionId);
  const data = buildCampaignData(formData, products);
  const sampleEmail = session.user?.email ?? "preview@janicka-shop.cz";
  const html = renderCampaignEmailPreview(data, sampleEmail);
  const db = await getDb();
  const subscriberCount = await db.newsletterSubscriber.count({
    where: {
      active: true,
      OR: [{ pausedUntil: null }, { pausedUntil: { lt: new Date() } }],
    },
  });
  return { html, subject: data.subject, subscriberCount };
}

export async function sendCampaignTestEmail(formData: FormData): Promise<{
  success: boolean;
  recipient?: string;
  error?: string;
}> {
  const session = await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) return { success: false, error: "Příliš mnoho požadavků." };

  const recipient = session.user?.email;
  if (!recipient) return { success: false, error: "Admin e-mail není nastaven." };

  const collectionId = (formData.get("collectionId") as string) || null;
  const products = await loadCollectionProducts(collectionId);
  const data = buildCampaignData(formData, products);

  if (!data.subject || !data.heading) {
    return { success: false, error: "Předmět a nadpis jsou povinné." };
  }

  const ok = await sendCampaignEmail(data, recipient);
  return ok
    ? { success: true, recipient }
    : { success: false, error: "Odeslání selhalo — zkontroluj SMTP konfiguraci." };
}
