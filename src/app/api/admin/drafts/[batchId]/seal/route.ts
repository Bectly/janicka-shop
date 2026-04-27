import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireDraftSessionForBatch } from "@/lib/draft-session";
import { sendBatchSealedAdminEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

export async function POST(_req: Request, context: RouteContext) {
  const { batchId } = await context.params;
  const session = await requireDraftSessionForBatch(batchId);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      adminId: true,
      status: true,
      bundle: { select: { invoiceNumber: true } },
    },
  });
  if (!batch || batch.adminId !== session.adminId) {
    return NextResponse.json({ error: "Batch nenalezen" }, { status: 404 });
  }
  if (batch.status === "sealed") {
    return NextResponse.json({ ok: true, alreadySealed: true });
  }
  if (batch.status !== "open") {
    return NextResponse.json(
      { error: `Batch je ve stavu ${batch.status}` },
      { status: 409 }
    );
  }

  const draftCount = await db.productDraft.count({
    where: { batchId, status: { in: ["pending", "ready"] } },
  });
  if (draftCount === 0) {
    return NextResponse.json(
      { error: "Batch nemá žádné drafty" },
      { status: 400 }
    );
  }

  await db.productDraftBatch.update({
    where: { id: batchId },
    data: { status: "sealed", sealedAt: new Date() },
  });

  // Fire-and-forget admin notification — never block seal on email failure.
  void (async () => {
    try {
      const drafts = await db.productDraft.findMany({
        where: { batchId, status: { in: ["pending", "ready"] } },
        select: { name: true, price: true },
        orderBy: { createdAt: "asc" },
        take: 50,
      });
      const label = batch.bundle?.invoiceNumber?.trim() || `#${batch.id.slice(-6).toUpperCase()}`;
      await sendBatchSealedAdminEmail({
        batchId: batch.id,
        batchLabel: label,
        count: draftCount,
        items: drafts.map((d) => ({ name: d.name ?? "", price: d.price })),
      });
    } catch (err) {
      logger.error("[drafts/seal] admin email failed:", err);
    }
  })().catch(() => {});

  return NextResponse.json({ ok: true, draftCount });
}
