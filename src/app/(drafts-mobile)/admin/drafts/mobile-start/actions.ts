"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db";
import {
  DRAFT_SESSION_COOKIE,
  DRAFT_SESSION_TTL_SECONDS,
  buildDraftSessionCookieValue,
} from "@/lib/draft-qr";
import { readDraftSession } from "@/lib/draft-session";

/**
 * J10-B3 — switch the active draft session from the freshly issued (empty) batch
 * to an existing open batch <24h old. The empty batch is removed so it doesn't
 * clutter /admin/drafts.
 */
export async function continueExistingBatchAction(formData: FormData): Promise<void> {
  const session = await readDraftSession();
  if (!session) redirect("/admin/login");

  const targetBatchId = String(formData.get("targetBatchId") ?? "");
  const newBatchId = String(formData.get("newBatchId") ?? "");
  if (!targetBatchId) redirect("/admin/login");

  const db = await getDb();

  // Verify target batch belongs to this admin and is still resumable.
  const target = await db.productDraftBatch.findUnique({
    where: { id: targetBatchId },
    select: { id: true, adminId: true, status: true },
  });
  if (!target || target.adminId !== session.adminId || target.status !== "open") {
    redirect(`/admin/drafts/${encodeURIComponent(newBatchId || session.batchId)}/mobile`);
  }

  // Best-effort cleanup of the freshly created empty batch the QR just issued.
  if (newBatchId && newBatchId !== targetBatchId) {
    const fresh = await db.productDraftBatch.findUnique({
      where: { id: newBatchId },
      select: { id: true, adminId: true, status: true, _count: { select: { drafts: true } } },
    });
    if (
      fresh &&
      fresh.adminId === session.adminId &&
      fresh.status === "open" &&
      fresh._count.drafts === 0
    ) {
      await db.productDraftBatch.delete({ where: { id: fresh.id } }).catch(() => {});
    }
  }

  // Repoint the session cookie to the resumed batch.
  const cookieStore = await cookies();
  cookieStore.set({
    name: DRAFT_SESSION_COOKIE,
    value: buildDraftSessionCookieValue(targetBatchId, session.adminId),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DRAFT_SESSION_TTL_SECONDS,
  });

  // Bump activity so the resumed batch doesn't immediately drift toward archive.
  await db.productDraftBatch.update({
    where: { id: targetBatchId },
    data: { lastActivityAt: new Date() },
  });

  redirect(`/admin/drafts/${encodeURIComponent(targetBatchId)}/mobile`);
}

export async function startNewBatchAction(formData: FormData): Promise<void> {
  const newBatchId = String(formData.get("newBatchId") ?? "");
  if (!newBatchId) redirect("/admin/login");
  redirect(`/admin/drafts/${encodeURIComponent(newBatchId)}/mobile`);
}
