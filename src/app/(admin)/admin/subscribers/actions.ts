"use server";

import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimitAdmin } from "@/lib/rate-limit";
import { sendCampaignEmail, sendVintedCampaignEmail, sendMothersDayEmail, sendCustomsCampaignEmail } from "@/lib/email";
import type { CampaignEmailData, CampaignProduct, VintedCampaignSegment, MothersDayEmailNumber, MothersDaySegment, CustomsEmailNumber } from "@/lib/email";
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

// ---------------------------------------------------------------------------
// Vinted T&C campaign (C2788 brief — April 28, 2026)
// ---------------------------------------------------------------------------

interface VintedCampaignResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  error?: string;
}

/**
 * Send the pre-built Vinted T&C campaign to active subscribers.
 * Segment determines subject line:
 *  - "warm": subscribers who signed up within last 90 days → Subject A
 *  - "cold": subscribers older than 90 days → Subject B
 *  - "all": auto-segments based on subscriber recency
 */
export async function sendVintedTcCampaign(
  segment: "warm" | "cold" | "all",
): Promise<VintedCampaignResult> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) {
    return { success: false, sentCount: 0, failedCount: 0, error: "Příliš mnoho požadavků. Zkuste to za chvíli." };
  }

  const db = await getDb();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Fetch active, non-paused subscribers
  const subscribers = await db.newsletterSubscriber.findMany({
    where: {
      active: true,
      OR: [
        { pausedUntil: null },
        { pausedUntil: { lt: now } },
      ],
    },
    select: { email: true, createdAt: true },
  });

  if (subscribers.length === 0) {
    return { success: true, sentCount: 0, failedCount: 0 };
  }

  // Determine subject line per subscriber
  const tagged: { email: string; segment: VintedCampaignSegment }[] = subscribers.map((s) => {
    if (segment === "all") {
      return {
        email: s.email,
        segment: s.createdAt >= ninetyDaysAgo ? "warm" : "cold",
      };
    }
    return { email: s.email, segment };
  });

  // Log campaign
  const subjectDesc = segment === "all"
    ? "Vinted T&C kampaň (auto-segment)"
    : segment === "warm"
      ? "Vinted T&C kampaň — Tvoje fotky patří tobě. Vždy."
      : "Vinted T&C kampaň — Zatímco Vinted školí AI...";

  const campaign = await db.campaignLog.create({
    data: {
      subject: subjectDesc,
      previewText: "U nás je to jinak. A vždy bylo.",
      status: "sending",
    },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < tagged.length; i += BATCH_SIZE) {
    const batch = tagged.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((sub) => sendVintedCampaignEmail(sub.segment, sub.email)),
    );
    for (const ok of results) {
      if (ok) sentCount++;
      else failedCount++;
    }

    if (i + BATCH_SIZE < tagged.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  await db.campaignLog.update({
    where: { id: campaign.id },
    data: { status: "completed", sentCount, failedCount },
  });

  return { success: true, sentCount, failedCount };
}

// ---------------------------------------------------------------------------
// EU Customs Duty 2026 — 2-email campaign (Task #104)
// ---------------------------------------------------------------------------

const CUSTOMS_LABELS: Record<CustomsEmailNumber, string> = {
  1: "EU clo #1 — Soft tease (15. června)",
  2: "EU clo #2 — Final push (28. června)",
};

interface CustomsCampaignResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  error?: string;
}

/**
 * Send one of the 2 EU customs duty campaign emails.
 * Loads up to 5 featured/newest available products to include.
 */
export async function sendCustomsDutyCampaign(
  emailNumber: CustomsEmailNumber,
): Promise<CustomsCampaignResult> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) {
    return { success: false, sentCount: 0, failedCount: 0, error: "Příliš mnoho požadavků. Zkuste to za chvíli." };
  }

  const db = await getDb();
  const now = new Date();

  // Load products for the email (featured first, then newest available)
  const productCount = emailNumber === 1 ? 4 : 5;
  const dbProducts = await db.product.findMany({
    where: { active: true, sold: false },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    select: {
      name: true,
      slug: true,
      price: true,
      compareAt: true,
      brand: true,
      condition: true,
      images: true,
    },
    take: productCount,
  });

  const products: CampaignProduct[] = dbProducts.map((p) => ({
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAt: p.compareAt,
    brand: p.brand,
    condition: p.condition,
    image: getImageUrls(p.images)[0] ?? null,
  }));

  // Fetch active, non-paused subscribers
  const subscribers = await db.newsletterSubscriber.findMany({
    where: {
      active: true,
      OR: [
        { pausedUntil: null },
        { pausedUntil: { lt: now } },
      ],
    },
    select: { email: true },
  });

  if (subscribers.length === 0) {
    return { success: true, sentCount: 0, failedCount: 0 };
  }

  // Log campaign
  const campaign = await db.campaignLog.create({
    data: {
      subject: CUSTOMS_LABELS[emailNumber],
      previewText: `EU clo email ${emailNumber}/2`,
      status: "sending",
    },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((sub) => sendCustomsCampaignEmail(emailNumber, products, sub.email)),
    );
    for (const ok of results) {
      if (ok) sentCount++;
      else failedCount++;
    }

    if (i + BATCH_SIZE < subscribers.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  await db.campaignLog.update({
    where: { id: campaign.id },
    data: { status: "completed", sentCount, failedCount },
  });

  return { success: true, sentCount, failedCount };
}

// ---------------------------------------------------------------------------
// Den matek 2026 — 3-email campaign (Task #103)
// ---------------------------------------------------------------------------

const MOTHERS_DAY_LABELS: Record<MothersDayEmailNumber, string> = {
  1: "Den matek #1 — Warmup (1. května)",
  2: "Den matek #2 — Push (7. května)",
  3: "Den matek #3 — Urgency (9. května)",
};

interface MothersDayCampaignResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  error?: string;
}

/**
 * Send one of the 3 Mother's Day campaign emails.
 * Email 1 uses warm/cold segmentation (different subject lines).
 * Emails 2 & 3 use the same subject for all subscribers.
 * Loads up to 6 featured/newest available products to include in the email.
 */
export async function sendMothersDayCampaign(
  emailNumber: MothersDayEmailNumber,
): Promise<MothersDayCampaignResult> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) {
    return { success: false, sentCount: 0, failedCount: 0, error: "Příliš mnoho požadavků. Zkuste to za chvíli." };
  }

  const db = await getDb();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Load products for the email (featured first, then newest available)
  const productCount = emailNumber === 3 ? 3 : emailNumber === 2 ? 6 : 4;
  const dbProducts = await db.product.findMany({
    where: { active: true, sold: false },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    select: {
      name: true,
      slug: true,
      price: true,
      compareAt: true,
      brand: true,
      condition: true,
      images: true,
    },
    take: productCount,
  });

  const products: CampaignProduct[] = dbProducts.map((p) => ({
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAt: p.compareAt,
    brand: p.brand,
    condition: p.condition,
    image: getImageUrls(p.images)[0] ?? null,
  }));

  // Fetch active, non-paused subscribers
  const subscribers = await db.newsletterSubscriber.findMany({
    where: {
      active: true,
      OR: [
        { pausedUntil: null },
        { pausedUntil: { lt: now } },
      ],
    },
    select: { email: true, createdAt: true },
  });

  if (subscribers.length === 0) {
    return { success: true, sentCount: 0, failedCount: 0 };
  }

  // Log campaign
  const campaign = await db.campaignLog.create({
    data: {
      subject: MOTHERS_DAY_LABELS[emailNumber],
      previewText: `Den matek email ${emailNumber}/3`,
      status: "sending",
    },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((sub) => {
        // Email 1 uses warm/cold segmentation, 2 & 3 use "warm" for all
        const segment: MothersDaySegment =
          emailNumber === 1
            ? sub.createdAt >= ninetyDaysAgo ? "warm" : "cold"
            : "warm";
        return sendMothersDayEmail(emailNumber, segment, products, sub.email);
      }),
    );
    for (const ok of results) {
      if (ok) sentCount++;
      else failedCount++;
    }

    if (i + BATCH_SIZE < subscribers.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  await db.campaignLog.update({
    where: { id: campaign.id },
    data: { status: "completed", sentCount, failedCount },
  });

  return { success: true, sentCount, failedCount };
}
