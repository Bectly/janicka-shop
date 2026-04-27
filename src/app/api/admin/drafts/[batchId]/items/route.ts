import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { requireDraftSessionForBatch } from "@/lib/draft-session";

const CONDITION_VALUES = [
  "new_with_tags",
  "new_without_tags",
  "excellent",
  "good",
  "visible_wear",
] as const;

const itemSchema = z.object({
  name: z.string().max(200).optional(),
  price: z.coerce.number().nonnegative().nullable().optional(),
  brand: z.string().max(100).nullable().optional(),
  categoryId: z.string().max(100).nullable().optional(),
  condition: z.enum(CONDITION_VALUES).optional(),
  description: z.string().max(5000).nullable().optional(),
  sizes: z.array(z.string().max(40)).max(20).optional(),
  colors: z.array(z.string().max(40)).max(20).optional(),
  images: z.array(z.string().url().max(2000)).max(10).optional(),
  measurements: z.record(z.string(), z.string().max(20)).optional(),
  fitNote: z.string().max(120).nullable().optional(),
  defectsNote: z.string().max(2000).nullable().optional(),
  defectImages: z.array(z.string().url().max(2000)).max(10).optional(),
  internalNote: z.string().max(2000).nullable().optional(),
  videoUrl: z.string().url().max(2000).nullable().optional(),
  compareAt: z.coerce.number().nonnegative().nullable().optional(),
  featured: z.boolean().optional(),
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
  weightG: z.coerce.number().int().positive().nullable().optional(),
});

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  const { batchId } = await context.params;
  const session = await requireDraftSessionForBatch(batchId);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const parsed = itemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatná data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = await getDb();
  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    select: { id: true, status: true, expiresAt: true, adminId: true },
  });
  if (!batch || batch.adminId !== session.adminId) {
    return NextResponse.json({ error: "Batch nenalezen" }, { status: 404 });
  }
  if (batch.status !== "open") {
    return NextResponse.json(
      { error: "Batch je již uzavřen" },
      { status: 409 }
    );
  }

  const data = parsed.data;
  const draft = await db.productDraft.create({
    data: {
      batchId,
      name: data.name?.trim() || null,
      price: data.price ?? null,
      brand: data.brand?.trim() || null,
      categoryId: data.categoryId ?? null,
      condition: data.condition ?? null,
      description: data.description?.trim() || null,
      sizes: data.sizes ? JSON.stringify(data.sizes) : "[]",
      colors: data.colors ? JSON.stringify(data.colors) : "[]",
      images: data.images ? JSON.stringify(data.images) : "[]",
      measurements: data.measurements
        ? JSON.stringify(data.measurements)
        : "{}",
      fitNote: data.fitNote?.trim() || null,
      defectsNote: data.defectsNote?.trim() || null,
      defectImages: data.defectImages ? JSON.stringify(data.defectImages) : "[]",
      internalNote: data.internalNote?.trim() || null,
      videoUrl: data.videoUrl ?? null,
      compareAt: data.compareAt ?? null,
      featured: data.featured ?? false,
      metaTitle: data.metaTitle?.trim() || null,
      metaDescription: data.metaDescription?.trim() || null,
      weightG: data.weightG ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json({ draftId: draft.id }, { status: 201 });
}
