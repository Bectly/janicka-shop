import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface RouteContext {
  params: Promise<{ batchId: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { batchId } = await context.params;
  const db = await getDb();

  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      adminId: true,
      status: true,
      expiresAt: true,
      sealedAt: true,
      _count: { select: { drafts: true } },
    },
  });

  if (!batch || batch.adminId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const status =
    batch.status === "open" && batch.expiresAt.getTime() < Date.now()
      ? "expired"
      : batch.status;

  return NextResponse.json({
    batchId: batch.id,
    status,
    draftCount: batch._count.drafts,
    expiresAt: batch.expiresAt.toISOString(),
    sealedAt: batch.sealedAt?.toISOString() ?? null,
  });
}
