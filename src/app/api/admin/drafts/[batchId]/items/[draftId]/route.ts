import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { readDraftSession } from "@/lib/draft-session";

const CONDITION_VALUES = [
  "new_with_tags",
  "new_without_tags",
  "excellent",
  "good",
  "visible_wear",
] as const;

const patchSchema = z.object({
  name: z.string().max(200).nullable().optional(),
  price: z.coerce.number().nonnegative().nullable().optional(),
  brand: z.string().max(100).nullable().optional(),
  categoryId: z.string().max(100).nullable().optional(),
  condition: z.enum(CONDITION_VALUES).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  sizes: z.array(z.string().max(40)).max(20).optional(),
  colors: z.array(z.string().max(40)).max(20).optional(),
  images: z.array(z.string().url().max(2000)).max(10).optional(),
  measurements: z.record(z.string(), z.string().max(20)).optional(),
  fitNote: z.string().max(120).nullable().optional(),
  defectsNote: z.string().max(2000).nullable().optional(),
  defectImages: z.array(z.string().url().max(2000)).max(10).optional(),
  internalNote: z.string().max(2000).nullable().optional(),
  status: z.enum(["pending", "ready", "discarded"]).optional(),
  videoUrl: z.string().url().max(2000).nullable().optional(),
  compareAt: z.coerce.number().nonnegative().nullable().optional(),
  featured: z.boolean().optional(),
  metaTitle: z.string().max(70).nullable().optional(),
  metaDescription: z.string().max(160).nullable().optional(),
  weightG: z.coerce.number().int().positive().nullable().optional(),
});

interface RouteContext {
  params: Promise<{ batchId: string; draftId: string }>;
}

async function authorizeForBatch(batchId: string): Promise<
  | { ok: true; isAdmin: boolean }
  | { ok: false; status: number; error: string }
> {
  const adminSession = await auth();
  if (adminSession?.user?.id && adminSession.user.role === "admin") {
    const db = await getDb();
    const batch = await db.productDraftBatch.findUnique({
      where: { id: batchId },
      select: { adminId: true },
    });
    if (!batch || batch.adminId !== adminSession.user.id) {
      return { ok: false, status: 404, error: "Batch nenalezen" };
    }
    return { ok: true, isAdmin: true };
  }

  const draftSession = await readDraftSession();
  if (draftSession && draftSession.batchId === batchId) {
    return { ok: true, isAdmin: false };
  }
  return { ok: false, status: 401, error: "Unauthorized" };
}

export async function PATCH(req: Request, context: RouteContext) {
  const { batchId, draftId } = await context.params;

  const authResult = await authorizeForBatch(batchId);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatná data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = await getDb();
  const existing = await db.productDraft.findUnique({
    where: { id: draftId },
    select: { id: true, batchId: true, status: true, batch: { select: { status: true } } },
  });
  if (!existing || existing.batchId !== batchId) {
    return NextResponse.json({ error: "Draft nenalezen" }, { status: 404 });
  }
  if (existing.status === "published") {
    return NextResponse.json(
      { error: "Publikovaný draft nelze upravit" },
      { status: 409 }
    );
  }
  // Janička can edit only while batch is open; admin can edit after seal too.
  if (!authResult.isAdmin && existing.batch.status !== "open") {
    return NextResponse.json(
      { error: "Batch je již uzavřen" },
      { status: 409 }
    );
  }

  const d = parsed.data;
  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name?.trim() || null;
  if (d.price !== undefined) data.price = d.price;
  if (d.brand !== undefined) data.brand = d.brand?.trim() || null;
  if (d.categoryId !== undefined) data.categoryId = d.categoryId;
  if (d.condition !== undefined) data.condition = d.condition;
  if (d.description !== undefined) data.description = d.description?.trim() || null;
  if (d.sizes !== undefined) data.sizes = JSON.stringify(d.sizes);
  if (d.colors !== undefined) data.colors = JSON.stringify(d.colors);
  if (d.images !== undefined) data.images = JSON.stringify(d.images);
  if (d.measurements !== undefined) data.measurements = JSON.stringify(d.measurements);
  if (d.fitNote !== undefined) data.fitNote = d.fitNote?.trim() || null;
  if (d.defectsNote !== undefined) data.defectsNote = d.defectsNote?.trim() || null;
  if (d.defectImages !== undefined) data.defectImages = JSON.stringify(d.defectImages);
  if (d.internalNote !== undefined) data.internalNote = d.internalNote?.trim() || null;
  if (d.status !== undefined) data.status = d.status;
  if (d.videoUrl !== undefined) data.videoUrl = d.videoUrl ?? null;
  if (d.compareAt !== undefined) data.compareAt = d.compareAt ?? null;
  if (d.featured !== undefined) data.featured = d.featured;
  if (d.metaTitle !== undefined) data.metaTitle = d.metaTitle?.trim() || null;
  if (d.metaDescription !== undefined) data.metaDescription = d.metaDescription?.trim() || null;
  if (d.weightG !== undefined) data.weightG = d.weightG ?? null;

  await db.productDraft.update({
    where: { id: draftId },
    data,
  });
  await db.productDraftBatch.update({
    where: { id: batchId },
    data: { lastActivityAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
