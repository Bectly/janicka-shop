"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

const itemSchema = z.object({
  draftId: z.string().min(1).max(64),
  weightG: z.coerce.number().int().min(1).max(9999).nullable().optional(),
  costBasis: z.coerce.number().min(0).nullable().optional(),
});

const saveSchema = z.object({
  bundleId: z.string().min(1),
  batchId: z.string().min(1),
  items: z.array(itemSchema).max(500),
});

export async function saveDistribution(input: z.infer<typeof saveSchema>) {
  const adminId = await requireAdmin();
  const parsed = saveSchema.parse(input);
  const db = await getDb();

  const batch = await db.productDraftBatch.findUnique({
    where: { id: parsed.batchId },
    select: { id: true, adminId: true, bundleId: true },
  });

  if (!batch || batch.adminId !== adminId || batch.bundleId !== parsed.bundleId) {
    throw new Error("Batch not found");
  }

  const draftIds = parsed.items.map((i) => i.draftId);
  const drafts = await db.productDraft.findMany({
    where: { batchId: parsed.batchId, id: { in: draftIds } },
    select: { id: true },
  });
  const validIds = new Set(drafts.map((d) => d.id));

  await db.$transaction(
    parsed.items
      .filter((i) => validIds.has(i.draftId))
      .map((i) =>
        db.productDraft.update({
          where: { id: i.draftId },
          data: {
            weightG: i.weightG ?? null,
            costBasis: i.costBasis ?? null,
          },
        }),
      ),
  );

  revalidatePath(`/admin/bundles/${parsed.bundleId}/distribute/${parsed.batchId}`);
  revalidatePath(`/admin/drafts/${parsed.batchId}`);
  revalidatePath(`/admin/bundles/${parsed.bundleId}`);

  return { ok: true as const, count: parsed.items.length };
}
