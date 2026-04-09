"use server";

import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimitAdmin } from "@/lib/rate-limit";
import { sendCampaignEmail } from "@/lib/email";
import type { CampaignEmailData, CampaignProduct } from "@/lib/email";
import { getImageUrls } from "@/lib/images";
import { parseJsonStringArray } from "@/lib/images";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function toggleSubscriberActive(id: string, active: boolean) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  await db.newsletterSubscriber.update({
    where: { id },
    data: { active },
  });
}

export async function getSubscribersCsv(): Promise<string> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  const subscribers = await db.newsletterSubscriber.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });

  const header = "email,first_name,preferred_sizes,preferred_categories,preferred_brands,source,subscribed_at";
  const rows = subscribers.map(
    (s) =>
      `${csvField(s.email)},${csvField(s.firstName ?? "")},${csvField(s.preferredSizes)},${csvField(s.preferredCategories)},${csvField(s.preferredBrands)},${csvField(s.source)},${s.createdAt.toISOString()}`,
  );
  // BOM for Excel UTF-8 recognition (matching orders CSV export)
  return "\uFEFF" + [header, ...rows].join("\n");
}

function csvField(value: string): string {
  const needsFormulaGuard =
    value.length > 0 &&
    (value[0] === "=" ||
      value[0] === "+" ||
      value[0] === "-" ||
      value[0] === "@" ||
      value[0] === "\t" ||
      value[0] === "\r");
  const safe = needsFormulaGuard ? "'" + value : value;
  if (
    safe.includes(",") ||
    safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r")
  ) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

// ---------------------------------------------------------------------------
// Newsletter campaign actions
// ---------------------------------------------------------------------------

export async function getCollectionsForCampaign() {
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

export async function getActiveSubscriberCount(): Promise<number> {
  await requireAdmin();
  const db = await getDb();
  return db.newsletterSubscriber.count({
    where: { active: true },
  });
}

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1100; // slightly over 1s to respect Resend rate limits

interface SendCampaignResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  error?: string;
}

export async function sendNewsletterCampaign(formData: FormData): Promise<SendCampaignResult> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) {
    return { success: false, sentCount: 0, failedCount: 0, error: "Příliš mnoho požadavků. Zkuste to za chvíli." };
  }

  const subject = (formData.get("subject") as string)?.trim();
  const previewText = (formData.get("previewText") as string)?.trim() ?? "";
  const heading = (formData.get("heading") as string)?.trim();
  const bodyText = (formData.get("bodyText") as string)?.trim();
  const collectionId = (formData.get("collectionId") as string) || null;
  const ctaText = (formData.get("ctaText") as string)?.trim() || "Prohlédnout";
  const ctaUrl = (formData.get("ctaUrl") as string)?.trim() || "";

  if (!subject || !heading) {
    return { success: false, sentCount: 0, failedCount: 0, error: "Předmět a nadpis jsou povinné." };
  }

  const db = await getDb();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  // Load products from collection if selected
  let products: CampaignProduct[] = [];
  if (collectionId) {
    const collection = await db.collection.findUnique({
      where: { id: collectionId },
      select: { productIds: true },
    });
    if (collection) {
      const ids = parseJsonStringArray(collection.productIds);
      if (ids.length > 0) {
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
          take: 8, // limit to 8 products in email grid
        });
        products = dbProducts.map((p) => ({
          name: p.name,
          slug: p.slug,
          price: p.price,
          compareAt: p.compareAt,
          brand: p.brand,
          condition: p.condition,
          image: getImageUrls(p.images)[0] ?? null,
        }));
      }
    }
  }

  // Build safe body HTML from plain text (line breaks → <br/>)
  const bodyHtml = bodyText
    ? bodyText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>")
    : "";

  const campaignData: CampaignEmailData = {
    subject,
    previewText,
    heading,
    bodyHtml,
    products,
    ctaText,
    ctaUrl: ctaUrl || `${baseUrl}/products?sort=newest`,
  };

  // Create campaign log entry
  const campaign = await db.campaignLog.create({
    data: {
      subject,
      previewText,
      collectionId,
      status: "sending",
    },
  });

  // Fetch all active subscribers
  const subscribers = await db.newsletterSubscriber.findMany({
    where: {
      active: true,
      OR: [
        { pausedUntil: null },
        { pausedUntil: { lt: new Date() } },
      ],
    },
    select: { email: true },
  });

  if (subscribers.length === 0) {
    await db.campaignLog.update({
      where: { id: campaign.id },
      data: { status: "completed", sentCount: 0, failedCount: 0 },
    });
    return { success: true, sentCount: 0, failedCount: 0 };
  }

  let sentCount = 0;
  let failedCount = 0;

  // Send in batches of 50 to respect Resend rate limits
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((sub) => sendCampaignEmail(campaignData, sub.email)),
    );
    for (const ok of results) {
      if (ok) sentCount++;
      else failedCount++;
    }

    // Delay between batches (skip after last batch)
    if (i + BATCH_SIZE < subscribers.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Update campaign log
  await db.campaignLog.update({
    where: { id: campaign.id },
    data: {
      status: "completed",
      sentCount,
      failedCount,
    },
  });

  return { success: true, sentCount, failedCount };
}

export async function getCampaignHistory() {
  await requireAdmin();
  const db = await getDb();
  return db.campaignLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}
