import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { moveDraftImageToProducts } from "@/lib/r2";
import { invalidateProductCaches } from "@/lib/redis";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

const bodySchema = z.object({
  draftIds: z.union([z.array(z.string().min(1)).max(200), z.literal("all")]),
});

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
  videoUrl: string | null;
  compareAt: number | null;
  featured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  weightG: number | null;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function validate(draft: DraftRow): string | null {
  if (!draft.name?.trim()) return "Chybí název";
  if (draft.price == null || draft.price <= 0) return "Chybí cena";
  if (!draft.condition) return "Chybí stav";
  if (!draft.categoryId) return "Chybí kategorie";
  let images: unknown = [];
  try {
    images = JSON.parse(draft.images);
  } catch {
    /* fallthrough */
  }
  if (!Array.isArray(images) || images.length === 0) return "Chybí fotky";
  return null;
}

async function moveImages(rawJson: string): Promise<string[]> {
  let urls: unknown = [];
  try {
    urls = JSON.parse(rawJson);
  } catch {
    return [];
  }
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  for (const u of urls) {
    if (typeof u !== "string") continue;
    try {
      const moved = await moveDraftImageToProducts(u);
      out.push(moved);
    } catch (err) {
      logger.warn("[drafts/publish] R2 move failed, keeping draft URL:", err);
      out.push(u);
    }
  }
  return out;
}

export async function POST(req: Request, context: RouteContext) {
  const adminSession = await auth();
  if (!adminSession?.user?.id || adminSession.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminId = adminSession.user.id;
  const { batchId } = await context.params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty body — defaults to all */
  }
  const parsed = bodySchema.safeParse(
    body && typeof body === "object" && "draftIds" in body ? body : { draftIds: "all" }
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatná data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const draftIds = parsed.data.draftIds;

  const db = await getDb();
  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      adminId: true,
      bundleId: true,
      bundleLineId: true,
      defaultWeightG: true,
      bundleLine: { select: { pricePerKg: true } },
    },
  });
  if (!batch || batch.adminId !== adminId) {
    return NextResponse.json({ error: "Batch nenalezen" }, { status: 404 });
  }

  const drafts = (await db.productDraft.findMany({
    where: {
      batchId,
      status: { in: ["pending", "ready"] },
      ...(draftIds === "all" ? {} : { id: { in: draftIds } }),
    },
  })) as DraftRow[];

  const published: { draftId: string; productId: string; slug: string }[] = [];
  const errors: { draftId: string; reason: string }[] = [];

  for (const draft of drafts) {
    const reason = validate(draft);
    if (reason) {
      errors.push({ draftId: draft.id, reason });
      continue;
    }

    try {
      const name = draft.name!.trim();
      const baseSlug = slugify(name) || `kousek-${Date.now().toString(36)}`;
      let slug = baseSlug;
      const exists = await db.product.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (exists) slug = `${baseSlug}-${Date.now().toString(36)}`;

      const sku = `JN-${Date.now().toString(36).toUpperCase()}-${draft.id.slice(-4).toUpperCase()}`;

      const movedUrls = await moveImages(draft.images);
      const normalizedImages = JSON.stringify(
        movedUrls.map((url) => ({ url, alt: "" }))
      );

      const movedDefectUrls = await moveImages(draft.defectImages);

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
          fitNote: draft.fitNote?.trim() || null,
          defectsNote: draft.defectsNote,
          defectImages: JSON.stringify(movedDefectUrls),
          internalNote: draft.internalNote?.trim() || null,
          videoUrl: draft.videoUrl ?? null,
          compareAt: draft.compareAt ?? null,
          featured: draft.featured,
          metaTitle: draft.metaTitle ?? null,
          metaDescription: draft.metaDescription ?? null,
          stock: 1,
          active: true,
          bundleId: batch.bundleId ?? null,
          bundleLineId: batch.bundleLineId ?? null,
          weightG: draft.weightG ?? batch.defaultWeightG ?? null,
          costBasis: (() => {
            const wg = draft.weightG ?? batch.defaultWeightG ?? null;
            return batch.bundleLineId && wg && batch.bundleLine
              ? (wg / 1000) * batch.bundleLine.pricePerKg
              : null;
          })(),
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

      await invalidateProductCaches({ slug: product.slug, id: product.id });

      published.push({ draftId: draft.id, productId: product.id, slug: product.slug });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Publikace selhala";
      logger.error("[drafts/publish] failed for draft", draft.id, err);
      errors.push({ draftId: draft.id, reason });
    }
  }

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

  return NextResponse.json({
    published: published.length,
    skipped: errors.length,
    publishedItems: published,
    errors,
  });
}
