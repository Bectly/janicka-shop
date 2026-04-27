import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSiteUrl } from "@/lib/site-url";
import {
  DRAFT_QR_TTL_SECONDS,
  hashDraftToken,
  signDraftQrToken,
} from "@/lib/draft-qr";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminId = session.user.id;
  const db = await getDb();

  const expiresAt = new Date(Date.now() + DRAFT_QR_TTL_SECONDS * 1000);

  const batch = await db.productDraftBatch.create({
    data: {
      adminId,
      tokenHash: "pending",
      expiresAt,
      status: "open",
    },
    select: { id: true },
  });

  const token = await signDraftQrToken(
    { batchId: batch.id, adminId },
    DRAFT_QR_TTL_SECONDS
  );
  const tokenHash = hashDraftToken(token);

  await db.productDraftBatch.update({
    where: { id: batch.id },
    data: { tokenHash },
  });

  const qrUrl = `${getSiteUrl()}/api/admin/drafts/auth?token=${encodeURIComponent(token)}`;

  return NextResponse.json({
    batchId: batch.id,
    qrUrl,
    expiresAt: expiresAt.toISOString(),
  });
}
