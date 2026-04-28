"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { invalidateProductCaches } from "@/lib/redis";

const CONDITION_VALUES = [
  "new_with_tags",
  "new_without_tags",
  "excellent",
  "good",
  "visible_wear",
] as const;

async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const draftEditSchema = z.object({
  name: z.string().max(200).optional(),
  price: z.coerce.number().nonnegative().nullable().optional(),
  compareAt: z.coerce.number().nonnegative().nullable().optional(),
  featured: z.boolean().optional(),
  brand: z.string().max(100).nullable().optional(),
  categoryId: z.string().max(100).nullable().optional(),
  condition: z.enum(CONDITION_VALUES).optional(),
  description: z.string().max(5000).nullable().optional(),
  sizes: z.array(z.string().max(40)).max(20).optional(),
  internalNote: z.string().max(2000).nullable().optional(),
  metaTitle: z.string().max(200).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
  videoUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  weightG: z.coerce.number().int().positive().nullable().optional(),
});

export async function updateDraftAction(
  batchId: string,
  draftId: string,
  patch: z.input<typeof draftEditSchema>,
) {
  const adminId = await requireAdmin();
  const db = await getDb();

  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    select: { adminId: true },
  });
  if (!batch || batch.adminId !== adminId) {
    throw new Error("Batch nenalezen");
  }

  const parsed = draftEditSchema.parse(patch);

  await db.productDraft.update({
    where: { id: draftId, batchId },
    data: {
      name: parsed.name ?? undefined,
      price: parsed.price !== undefined ? parsed.price : undefined,
      compareAt: parsed.compareAt !== undefined ? parsed.compareAt : undefined,
      featured: parsed.featured ?? undefined,
      brand: parsed.brand !== undefined ? parsed.brand : undefined,
      categoryId: parsed.categoryId !== undefined ? parsed.categoryId : undefined,
      condition: parsed.condition ?? undefined,
      description: parsed.description !== undefined ? parsed.description : undefined,
      sizes: parsed.sizes ? JSON.stringify(parsed.sizes) : undefined,
      internalNote: parsed.internalNote !== undefined ? parsed.internalNote : undefined,
      metaTitle: parsed.metaTitle !== undefined ? parsed.metaTitle : undefined,
      metaDescription: parsed.metaDescription !== undefined ? parsed.metaDescription : undefined,
      videoUrl: parsed.videoUrl !== undefined ? (parsed.videoUrl === "" ? null : parsed.videoUrl) : undefined,
      weightG: parsed.weightG !== undefined ? parsed.weightG : undefined,
    },
  });

  revalidatePath(`/admin/drafts/${batchId}`);
}

export async function discardDraftAction(batchId: string, draftId: string) {
  const adminId = await requireAdmin();
  const db = await getDb();

  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    select: { adminId: true },
  });
  if (!batch || batch.adminId !== adminId) {
    throw new Error("Batch nenalezen");
  }

  await db.productDraft.update({
    where: { id: draftId, batchId },
    data: { status: "discarded" },
  });

  revalidatePath(`/admin/drafts/${batchId}`);
}

interface PublishResult {
  publishedIds: string[];
  errors: { draftId: string; reason: string }[];
}

export async function publishDraftsAction(
  batchId: string,
  draftIds: string[] | "all",
): Promise<PublishResult> {
  const adminId = await requireAdmin();
  const db = await getDb();

  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    select: { adminId: true },
  });
  if (!batch || batch.adminId !== adminId) {
    throw new Error("Batch nenalezen");
  }

  const drafts = await db.productDraft.findMany({
    where: {
      batchId,
      status: { in: ["pending", "ready"] },
      ...(draftIds === "all"
        ? {}
        : { id: { in: draftIds } }),
    },
  });

  const publishedIds: string[] = [];
  const errors: { draftId: string; reason: string }[] = [];

  for (const draft of drafts) {
    const reason = validateDraftForPublish(draft);
    if (reason) {
      errors.push({ draftId: draft.id, reason });
      continue;
    }

    try {
      const product = await publishOne(draft);
      publishedIds.push(draft.id);
      await invalidateProductCaches({ slug: product.slug, id: product.id });
    } catch (err) {
      errors.push({
        draftId: draft.id,
        reason: err instanceof Error ? err.message : "Publikace selhala",
      });
    }
  }

  // If all remaining drafts in batch are now published or discarded, mark batch published
  const remaining = await db.productDraft.count({
    where: { batchId, status: { in: ["pending", "ready"] } },
  });
  if (remaining === 0) {
    await db.productDraftBatch.update({
      where: { id: batchId },
      data: { status: "published", publishedAt: new Date() },
    });
  }

  revalidatePath(`/admin/drafts/${batchId}`);
  revalidatePath("/admin/products");

  return { publishedIds, errors };
}

interface DraftRow {
  id: string;
  name: string | null;
  price: number | null;
  categoryId: string | null;
  brand: string | null;
  condition: string | null;
  sizes: string;
  colors: string;
  images: string;
  description: string | null;
  measurements: string;
  fitNote: string | null;
  defectsNote: string | null;
  defectImages: string;
  internalNote: string | null;
}

function validateDraftForPublish(draft: DraftRow): string | null {
  if (!draft.name?.trim()) return "Chybí název";
  if (draft.price == null || draft.price <= 0) return "Chybí cena";
  if (!draft.categoryId) return "Chybí kategorie";
  if (!draft.condition) return "Chybí stav";

  let images: unknown = [];
  try {
    images = JSON.parse(draft.images);
  } catch {
    /* fallthrough */
  }
  if (!Array.isArray(images) || images.length === 0) return "Chybí fotky";
  return null;
}

export async function bulkUpdateDraftsAction(
  batchId: string,
  draftIds: string[],
  patch: {
    categoryId?: string | null;
    compareAt?: number | null;
    bundleId?: string | null;
    discountPct?: number | null;
  },
): Promise<{ updatedCount: number }> {
  const adminId = await requireAdmin();

  if (!Array.isArray(draftIds) || draftIds.length === 0 || draftIds.length > 100) {
    throw new Error("Neplatné ID");
  }

  const db = await getDb();

  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    select: { adminId: true },
  });
  if (!batch || batch.adminId !== adminId) {
    throw new Error("Unauthorized");
  }

  const { discountPct, ...rest } = patch;

  let updatedCount = 0;

  if (discountPct != null && discountPct > 0 && discountPct < 100) {
    const drafts = await db.productDraft.findMany({
      where: { id: { in: draftIds }, batchId },
      select: { id: true, price: true, compareAt: true },
    });
    for (const d of drafts) {
      if (d.price == null || d.price <= 0) continue;
      const original = d.compareAt ?? d.price;
      const newPrice = Math.max(1, Math.round(d.price * (1 - discountPct / 100)));
      await db.productDraft.update({
        where: { id: d.id },
        data: {
          price: newPrice,
          compareAt: d.compareAt ?? original,
          ...rest,
        },
      });
      updatedCount += 1;
    }
  } else {
    const result = await db.productDraft.updateMany({
      where: { id: { in: draftIds }, batchId },
      data: rest,
    });
    updatedCount = result.count;
  }

  revalidatePath(`/admin/drafts/${batchId}`);
  return { updatedCount };
}

export async function reopenBatchAction(batchId: string): Promise<{
  qrUrl: string;
  expiresAt: string;
}> {
  const adminId = await requireAdmin();
  const db = await getDb();

  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    select: { adminId: true, status: true },
  });
  if (!batch || batch.adminId !== adminId) {
    throw new Error("Batch nenalezen");
  }
  if (batch.status === "published") {
    throw new Error("Publikovaný batch nelze znovu otevřít");
  }

  const { signDraftQrToken, hashDraftToken, DRAFT_QR_TTL_SECONDS } = await import(
    "@/lib/draft-qr"
  );
  const { getSiteUrl } = await import("@/lib/site-url");

  const expiresAt = new Date(Date.now() + DRAFT_QR_TTL_SECONDS * 1000);
  const token = await signDraftQrToken({ batchId, adminId }, DRAFT_QR_TTL_SECONDS);
  const tokenHash = hashDraftToken(token);

  await db.productDraftBatch.update({
    where: { id: batchId },
    data: { status: "open", tokenHash, expiresAt, sealedAt: null },
  });

  revalidatePath(`/admin/drafts/${batchId}`);

  return {
    qrUrl: `${getSiteUrl()}/api/admin/drafts/auth?token=${encodeURIComponent(token)}`,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function deleteBatchAction(batchId: string): Promise<{ success: true }> {
  const adminId = await requireAdmin();
  const db = await getDb();

  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    select: { adminId: true, status: true },
  });
  if (!batch || batch.adminId !== adminId) {
    throw new Error("Batch nenalezen");
  }
  if (batch.status === "published") {
    throw new Error("Publikovaný batch nelze smazat");
  }

  // Cascade deletes drafts (onDelete: Cascade in schema)
  await db.productDraftBatch.delete({ where: { id: batchId } });

  revalidatePath("/admin/drafts");
  return { success: true };
}

async function publishOne(draft: DraftRow) {
  const db = await getDb();
  const name = draft.name!.trim();
  const baseSlug = slugify(name) || `kousek-${Date.now().toString(36)}`;

  let slug = baseSlug;
  const exists = await db.product.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (exists) {
    slug = `${baseSlug}-${Date.now().toString(36)}`;
  }

  const sku = `JN-${Date.now().toString(36).toUpperCase()}-${draft.id.slice(-4).toUpperCase()}`;

  // Normalize images: mobile form stores plain URL strings; Product expects {url, alt}[].
  let normalizedImages = "[]";
  try {
    const arr = JSON.parse(draft.images) as unknown[];
    if (Array.isArray(arr)) {
      const norm = arr.map((item) =>
        typeof item === "string"
          ? { url: item, alt: "" }
          : (item as Record<string, unknown>),
      );
      normalizedImages = JSON.stringify(norm);
    }
  } catch {
    normalizedImages = "[]";
  }

  const product = await db.product.create({
    data: {
      name,
      slug,
      description: (draft.description?.trim() || name).slice(0, 5000),
      price: draft.price!,
      sku,
      categoryId: draft.categoryId!,
      brand: draft.brand?.trim() || null,
      condition: draft.condition!,
      sizes: draft.sizes,
      colors: draft.colors,
      images: normalizedImages,
      measurements: draft.measurements,
      defectsNote: draft.defectsNote,
      defectImages: draft.defectImages,
      fitNote: draft.fitNote?.trim() || null,
      internalNote: draft.internalNote?.trim() || null,
      stock: 1,
      featured: false,
      active: true,
    },
    select: { id: true, slug: true, price: true },
  });

  await db.priceHistory.create({
    data: { productId: product.id, price: product.price },
  });

  await db.productDraft.update({
    where: { id: draft.id },
    data: { status: "published", publishedProductId: product.id },
  });

  return product;
}
