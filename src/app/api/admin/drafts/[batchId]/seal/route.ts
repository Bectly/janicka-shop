import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";
import { requireDraftSessionForBatch } from "@/lib/draft-session";

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
    select: { id: true, adminId: true, status: true },
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

  return NextResponse.json({ ok: true, draftCount });
}
