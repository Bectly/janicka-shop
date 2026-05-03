"use server";

import { requireAdmin } from "@/lib/require-admin";
import { getDb } from "@/lib/db";
import { rateLimitAdmin } from "@/lib/rate-limit";
import {
  renderCampaignEmailPreview,
  sendCampaignEmail,
  renderEmailPreview,
  EMAIL_PREVIEW_TEMPLATES,
} from "@/lib/email";
import type { CampaignEmailData, CampaignProduct } from "@/lib/email";
import { getImageUrls, parseJsonStringArray } from "@/lib/images";
import { getMailer } from "@/lib/email/resend-transport";
import {
  FROM_ORDERS,
  FROM_INFO,
  FROM_NEWSLETTER,
  FROM_SUPPORT,
  REPLY_TO,
} from "@/lib/email/addresses";
import { logger } from "@/lib/logger";

function buildCampaignData(formData: FormData, products: CampaignProduct[]): CampaignEmailData {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jvsatnik.cz";
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
    : { success: false, error: "Odeslání selhalo — zkontroluj Resend konfiguraci." };
}

function fromForGroup(group: string): string {
  switch (group) {
    case "Marketing":
      return FROM_NEWSLETTER;
    case "Účet":
      return FROM_SUPPORT;
    case "Admin":
      return FROM_INFO;
    default:
      return FROM_ORDERS;
  }
}

export interface TemplateEntry {
  key: string;
  label: string;
  group: string;
  subject: string;
  from: string;
}

export async function listTemplateEntries(): Promise<TemplateEntry[]> {
  await requireAdmin();
  return EMAIL_PREVIEW_TEMPLATES.map((t) => {
    const preview = renderEmailPreview(t.key);
    return {
      key: t.key,
      label: t.label,
      group: t.group,
      subject: preview?.subject ?? "(náhled nedostupný)",
      from: fromForGroup(t.group),
    };
  });
}

export async function sendTemplateTestEmail(templateKey: string): Promise<{
  success: boolean;
  recipient?: string;
  error?: string;
  messageId?: string;
}> {
  const session = await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) return { success: false, error: "Příliš mnoho požadavků." };

  const recipient = session.user?.email;
  if (!recipient) return { success: false, error: "Admin e-mail není nastaven." };

  const entry = EMAIL_PREVIEW_TEMPLATES.find((t) => t.key === templateKey);
  if (!entry) return { success: false, error: `Šablona ${templateKey} neexistuje.` };

  const preview = renderEmailPreview(templateKey);
  if (!preview) return { success: false, error: `Náhled šablony selhal.` };

  const mailer = getMailer();
  if (!mailer) {
    return {
      success: false,
      error: "E-mailová služba není nakonfigurovaná — nastav RESEND_API_KEY.",
    };
  }

  try {
    const info = await mailer.sendMail({
      from: fromForGroup(entry.group),
      replyTo: REPLY_TO,
      to: recipient,
      subject: `[TEST] ${preview.subject}`,
      html: preview.html,
      headers: {
        "X-Janicka-Preview": "1",
        "X-Janicka-Template": templateKey,
        "X-Janicka-Group": entry.group,
      },
    });
    return {
      success: true,
      recipient,
      messageId: info.messageId ?? undefined,
    };
  } catch (err) {
    logger.error("[email-templates] send test failed", {
      template: templateKey,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Odeslání selhalo.",
    };
  }
}
