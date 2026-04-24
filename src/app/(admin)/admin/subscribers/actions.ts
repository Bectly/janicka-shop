"use server";

import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimitAdmin } from "@/lib/rate-limit";
import { claimCampaignSendLock, releaseCampaignSendLock } from "@/lib/campaign-lock";
import {
  sendCampaignEmail,
  sendMothersDayEmail,
  sendCustomsCampaignEmail,
  renderMothersDayPreview,
  renderCustomsCampaignPreview,
} from "@/lib/email";
import type { CampaignEmailData, CampaignProduct, MothersDayEmailNumber, MothersDaySegment, CustomsEmailNumber } from "@/lib/email";
import { getImageUrls } from "@/lib/images";
import { parseJsonStringArray } from "@/lib/images";
import { runMothersDayCampaign } from "@/lib/campaigns/mothers-day";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

// One full campaign send per 1h window per key, enforced atomically in the
// DB (see campaign-lock.ts). This is critical on Vercel where each serverless
// instance has its own process memory — a prior in-memory guard could
// double-send if two instances raced.
const FULL_SEND_WINDOW_MS = 60 * 60 * 1000;

export async function toggleSubscriberActive(id: string, active: boolean) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  await db.newsletterSubscriber.update({
    where: { id },
    data: { active },
  });
  revalidateTag("admin-subscribers", "max");
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jvsatnik.cz";

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

  revalidateTag("admin-subscribers", "max");
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
  confirmation?: string,
): Promise<CustomsCampaignResult> {
  await requireAdmin();
  if (confirmation !== "OSLOVIT") {
    return { success: false, sentCount: 0, failedCount: 0, error: "Potvrzení 'OSLOVIT' chybí nebo není správně." };
  }
  const rl = await rateLimitAdmin();
  if (!rl.success) {
    return { success: false, sentCount: 0, failedCount: 0, error: "Příliš mnoho požadavků. Zkuste to za chvíli." };
  }
  const customsLockKey = `customs:${emailNumber}`;
  const customsLock = await claimCampaignSendLock(customsLockKey, FULL_SEND_WINDOW_MS);
  if (!customsLock.success) {
    return { success: false, sentCount: 0, failedCount: 0, error: customsLock.error };
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
    await releaseCampaignSendLock(customsLockKey);
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

  revalidateTag("admin-subscribers", "max");
  return { success: true, sentCount, failedCount };
}

// ---------------------------------------------------------------------------
// Den matek 2026 — 3-email campaign (Task #103)
// ---------------------------------------------------------------------------

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
  confirmation?: string,
): Promise<MothersDayCampaignResult> {
  await requireAdmin();
  if (confirmation !== "OSLOVIT") {
    return { success: false, sentCount: 0, failedCount: 0, error: "Potvrzení 'OSLOVIT' chybí nebo není správně." };
  }
  const rl = await rateLimitAdmin();
  if (!rl.success) {
    return { success: false, sentCount: 0, failedCount: 0, error: "Příliš mnoho požadavků. Zkuste to za chvíli." };
  }
  return runMothersDayCampaign(emailNumber);
}

// ---------------------------------------------------------------------------
// Campaign dry-run / preview + test-send-to-self (Task #221)
// ---------------------------------------------------------------------------

interface CampaignPreview {
  subject: string;
  html: string;
  subscriberCount: number;
  sampleEmail: string;
  /** Preheader / preview-text shown by most mail clients next to the subject. */
  previewText?: string;
  /** First ~300 chars of the rendered HTML body (quick diff-check before sending). */
  htmlExcerpt?: string;
  /** Active CampaignSendLock rows that would block an immediate send. */
  lockStatus?: { campaignKey: string; expiresAt: string }[];
  segmentCounts?: { warm: number; cold: number };
  /** Subject line actually used for each segment (only set on auto-segment preview). */
  segmentSubjects?: { warm: string; cold: string };
}

interface TestSendResult {
  success: boolean;
  recipient?: string;
  error?: string;
}

async function loadMothersDayProducts(
  emailNumber: MothersDayEmailNumber,
): Promise<CampaignProduct[]> {
  const db = await getDb();
  const productCount = emailNumber === 3 ? 3 : emailNumber === 2 ? 6 : 4;
  const dbProducts = await db.product.findMany({
    where: { active: true, sold: false },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    select: {
      name: true, slug: true, price: true, compareAt: true,
      brand: true, condition: true, images: true,
    },
    take: productCount,
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

async function loadCustomsProducts(
  emailNumber: CustomsEmailNumber,
): Promise<CampaignProduct[]> {
  const db = await getDb();
  const productCount = emailNumber === 1 ? 4 : 5;
  const dbProducts = await db.product.findMany({
    where: { active: true, sold: false },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    select: {
      name: true, slug: true, price: true, compareAt: true,
      brand: true, condition: true, images: true,
    },
    take: productCount,
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

async function getAdminTestRecipient(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (email) return email;
  return process.env.ADMIN_NOTIFICATION_EMAIL ?? null;
}

/** Preview a Mother's Day campaign email. */
export async function previewMothersDayCampaign(
  emailNumber: MothersDayEmailNumber,
): Promise<CampaignPreview> {
  await requireAdmin();
  const db = await getDb();
  const now = new Date();
  const subscriberCount = await db.newsletterSubscriber.count({
    where: {
      active: true,
      OR: [{ pausedUntil: null }, { pausedUntil: { lt: now } }],
    },
  });
  const products = await loadMothersDayProducts(emailNumber);
  const sampleEmail = (await getAdminTestRecipient()) ?? "preview@janicka-shop.cz";
  const segment: MothersDaySegment = "warm";
  const { subject, html } = renderMothersDayPreview(emailNumber, segment, products, sampleEmail);
  return { subject, html, subscriberCount, sampleEmail };
}

/** Send a single Mother's Day test email to the current admin only. */
export async function sendMothersDayTestEmail(
  emailNumber: MothersDayEmailNumber,
): Promise<TestSendResult> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) {
    return { success: false, error: "Příliš mnoho požadavků. Zkuste to za chvíli." };
  }
  const recipient = await getAdminTestRecipient();
  if (!recipient) {
    return { success: false, error: "Není nastavený admin e-mail pro test." };
  }
  const products = await loadMothersDayProducts(emailNumber);
  const segment: MothersDaySegment = "warm";
  const ok = await sendMothersDayEmail(emailNumber, segment, products, recipient);
  return ok
    ? { success: true, recipient }
    : { success: false, error: "Test-email se nepodařilo odeslat. Zkontroluj SMTP konfiguraci." };
}

/** Preview a customs duty campaign email. */
export async function previewCustomsCampaign(
  emailNumber: CustomsEmailNumber,
): Promise<CampaignPreview> {
  await requireAdmin();
  const db = await getDb();
  const now = new Date();
  const subscriberCount = await db.newsletterSubscriber.count({
    where: {
      active: true,
      OR: [{ pausedUntil: null }, { pausedUntil: { lt: now } }],
    },
  });
  const products = await loadCustomsProducts(emailNumber);
  const sampleEmail = (await getAdminTestRecipient()) ?? "preview@janicka-shop.cz";
  const { subject, html } = renderCustomsCampaignPreview(emailNumber, products, sampleEmail);
  return { subject, html, subscriberCount, sampleEmail };
}

/** Send a single customs duty test email to the current admin only. */
export async function sendCustomsTestEmail(
  emailNumber: CustomsEmailNumber,
): Promise<TestSendResult> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) {
    return { success: false, error: "Příliš mnoho požadavků. Zkuste to za chvíli." };
  }
  const recipient = await getAdminTestRecipient();
  if (!recipient) {
    return { success: false, error: "Není nastavený admin e-mail pro test." };
  }
  const products = await loadCustomsProducts(emailNumber);
  const ok = await sendCustomsCampaignEmail(emailNumber, products, recipient);
  return ok
    ? { success: true, recipient }
    : { success: false, error: "Test-email se nepodařilo odeslat. Zkontroluj SMTP konfiguraci." };
}
