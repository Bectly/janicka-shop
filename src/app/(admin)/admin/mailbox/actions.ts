"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
}

/** Mark every message in a thread as read and zero the thread unreadCount. */
export async function markThreadReadAction(threadId: string) {
  await requireAdmin();
  if (typeof threadId !== "string" || threadId.length === 0) return;

  const db = await getDb();
  const now = new Date();

  await db.emailMessage.updateMany({
    where: { threadId, readAt: null },
    data: { readAt: now },
  });
  await db.emailThread.update({
    where: { id: threadId },
    data: { unreadCount: 0 },
  });

  revalidatePath("/admin/mailbox");
  revalidatePath(`/admin/mailbox/${threadId}`);
}

export async function markThreadUnreadAction(threadId: string) {
  await requireAdmin();
  if (typeof threadId !== "string" || threadId.length === 0) return;

  const db = await getDb();
  await db.emailMessage.updateMany({
    where: { threadId },
    data: { readAt: null },
  });
  const count = await db.emailMessage.count({ where: { threadId } });
  await db.emailThread.update({
    where: { id: threadId },
    data: { unreadCount: count },
  });

  revalidatePath("/admin/mailbox");
  revalidatePath(`/admin/mailbox/${threadId}`);
}

export async function archiveThreadAction(threadId: string) {
  await requireAdmin();
  if (typeof threadId !== "string" || threadId.length === 0) return;

  const db = await getDb();
  await db.emailThread.update({
    where: { id: threadId },
    data: { archived: true },
  });
  revalidatePath("/admin/mailbox");
  redirect("/admin/mailbox");
}

export async function unarchiveThreadAction(threadId: string) {
  await requireAdmin();
  if (typeof threadId !== "string" || threadId.length === 0) return;

  const db = await getDb();
  await db.emailThread.update({
    where: { id: threadId },
    data: { archived: false },
  });
  revalidatePath("/admin/mailbox");
  revalidatePath(`/admin/mailbox/${threadId}`);
}

export async function trashThreadAction(threadId: string) {
  await requireAdmin();
  if (typeof threadId !== "string" || threadId.length === 0) return;

  const db = await getDb();
  await db.emailThread.update({
    where: { id: threadId },
    data: { trashed: true },
  });
  revalidatePath("/admin/mailbox");
  redirect("/admin/mailbox");
}

export async function flagThreadAction(threadId: string, flagged: boolean) {
  await requireAdmin();
  if (typeof threadId !== "string" || threadId.length === 0) return;

  const db = await getDb();
  await db.emailThread.update({
    where: { id: threadId },
    data: { flagged },
  });
  revalidatePath("/admin/mailbox");
  revalidatePath(`/admin/mailbox/${threadId}`);
}
