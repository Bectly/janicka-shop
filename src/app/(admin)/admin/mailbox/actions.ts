"use server";

import { randomBytes } from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getMailer } from "@/lib/email/smtp-transport";
import {
  FROM_INFO,
  FROM_ORDERS,
  FROM_SUPPORT,
  REPLY_TO,
} from "@/lib/email/addresses";
import { logger } from "@/lib/logger";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
}

function parseJsonList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function pickFromForReply(incomingTo: string[]): string {
  // Match on the local-part so the reply comes from the same mailbox the
  // customer originally wrote to.
  const joined = incomingTo.join(",").toLowerCase();
  if (joined.includes("objednavky@")) return FROM_ORDERS;
  if (joined.includes("info@")) return FROM_INFO;
  return FROM_SUPPORT;
}

function pickFromForCategory(category: string | null | undefined): string {
  if (category === "orders") return FROM_ORDERS;
  if (category === "info") return FROM_INFO;
  return FROM_SUPPORT;
}

function senderAddress(from: string): string {
  // Extract the bare email from "Name <email@host>" format.
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

function makeMessageId(domain: string): string {
  const rand = randomBytes(12).toString("hex");
  const ts = Date.now().toString(36);
  return `<${ts}-${rand}@${domain}>`;
}

function hostFromAddress(addr: string): string {
  const at = addr.lastIndexOf("@");
  return at >= 0 ? addr.slice(at + 1) : "jvsatnik.cz";
}

function normalizeSubjectForReply(subject: string): string {
  const s = subject?.trim() || "(bez předmětu)";
  return /^re:\s/i.test(s) ? s : `Re: ${s}`;
}

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
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
  revalidateTag("admin-badges", "max");
  revalidateTag("admin-mailbox", "max");
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
  revalidateTag("admin-badges", "max");
  revalidateTag("admin-mailbox", "max");
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
  revalidateTag("admin-badges", "max");
  revalidateTag("admin-mailbox", "max");
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
  revalidateTag("admin-badges", "max");
  revalidateTag("admin-mailbox", "max");
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
  revalidateTag("admin-badges", "max");
  revalidateTag("admin-mailbox", "max");
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

// --- Phase 3: compose + reply ---

function plainToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:sans-serif;white-space:pre-wrap;line-height:1.5">${escaped}</div>`;
}

function buildQuotedReply(
  latestFromName: string | null,
  latestFromAddress: string,
  latestReceivedAt: Date,
  latestBodyText: string | null,
): string {
  const sender = latestFromName?.trim() || latestFromAddress;
  const header = `Dne ${latestReceivedAt.toLocaleString("cs-CZ")} ${sender} napsal(a):`;
  const quoted = (latestBodyText ?? "")
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
  return `\n\n${header}\n${quoted}`.trimEnd();
}

type SendReplyState = { ok: boolean; error?: string };

/**
 * Send a reply on an existing thread. Persists an outbound EmailMessage with
 * RFC 5322 In-Reply-To + References so receiving clients keep threading, and
 * picks the FROM address that matches the mailbox the customer originally
 * wrote to.
 */
export async function sendReplyAction(
  threadId: string,
  _prev: SendReplyState | undefined,
  formData: FormData,
): Promise<SendReplyState> {
  await requireAdmin();
  if (typeof threadId !== "string" || threadId.length === 0) {
    return { ok: false, error: "Chybí identifikátor konverzace." };
  }

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { ok: false, error: "Text zprávy nemůže být prázdný." };

  const mailer = getMailer();
  if (!mailer) {
    return {
      ok: false,
      error: "SMTP není nakonfigurované — nastav SMTP_HOST/SMTP_USER/SMTP_PASSWORD.",
    };
  }

  const db = await getDb();
  const thread = await db.emailThread.findUnique({
    where: { id: threadId },
    include: {
      messages: {
        orderBy: { receivedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!thread || thread.messages.length === 0) {
    return { ok: false, error: "Konverzace nenalezena." };
  }

  const latest = thread.messages[0];
  const latestTo = parseJsonList(latest.toAddresses);
  const latestCc = parseJsonList(latest.ccAddresses);
  const from = pickFromForReply(latestTo);
  const fromAddr = senderAddress(from);
  const host = hostFromAddress(fromAddr) || "jvsatnik.cz";
  const messageId = makeMessageId(host);

  // References chain = existing chain + parent message-id (RFC 5322 §3.6.4).
  const priorRefs = parseJsonList(latest.referencesIds);
  const referencesIds = Array.from(new Set([...priorRefs, latest.messageId]));
  const to = latest.fromAddress;
  const subject = normalizeSubjectForReply(thread.subject);
  const quoted = buildQuotedReply(
    latest.fromName,
    latest.fromAddress,
    latest.receivedAt,
    latest.bodyText,
  );
  const fullText = `${body}${quoted}`;

  try {
    await mailer.sendMail({
      from,
      to,
      replyTo: REPLY_TO,
      subject,
      text: fullText,
      html: plainToHtml(fullText),
      messageId,
      inReplyTo: latest.messageId,
      references: referencesIds,
    });
  } catch (err) {
    logger.error("[mailbox] send reply failed", {
      threadId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "SMTP odeslání selhalo. Zkontroluj logy." };
  }

  const now = new Date();
  await db.emailMessage.create({
    data: {
      threadId,
      messageId,
      inReplyTo: latest.messageId,
      referencesIds: JSON.stringify(referencesIds),
      direction: "outbound",
      fromAddress: fromAddr,
      fromName: "Janička",
      toAddresses: JSON.stringify([to]),
      ccAddresses: JSON.stringify(latestCc),
      subject,
      bodyText: fullText,
      bodyHtml: plainToHtml(fullText),
      receivedAt: now,
      readAt: now,
    },
  });

  const existingParticipants = parseJsonList(thread.participants);
  const mergedParticipants = Array.from(
    new Set([...existingParticipants, fromAddr, to]),
  );
  await db.emailThread.update({
    where: { id: threadId },
    data: {
      lastMessageAt: now,
      messageCount: { increment: 1 },
      participants: JSON.stringify(mergedParticipants),
      archived: false,
    },
  });

  revalidatePath("/admin/mailbox");
  revalidatePath(`/admin/mailbox/${threadId}`);
  revalidateTag("admin-mailbox", "max");
  return { ok: true };
}

type NewMessageState = { ok: boolean; error?: string; threadId?: string };

/**
 * Compose and send a brand-new outbound thread to one or more recipients.
 * Creates a fresh EmailThread and seeds it with the outbound EmailMessage.
 */
export async function sendNewMessageAction(
  _prev: NewMessageState | undefined,
  formData: FormData,
): Promise<NewMessageState> {
  await requireAdmin();

  const toRaw = String(formData.get("to") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "support");

  const toList = parseRecipients(toRaw);
  if (toList.length === 0) {
    return { ok: false, error: "Zadej alespoň jednoho validního příjemce." };
  }
  if (!subject) return { ok: false, error: "Předmět nemůže být prázdný." };
  if (!body) return { ok: false, error: "Text zprávy nemůže být prázdný." };

  const mailer = getMailer();
  if (!mailer) {
    return {
      ok: false,
      error: "SMTP není nakonfigurované — nastav SMTP_HOST/SMTP_USER/SMTP_PASSWORD.",
    };
  }

  const from = pickFromForCategory(category);
  const fromAddr = senderAddress(from);
  const host = hostFromAddress(fromAddr) || "jvsatnik.cz";
  const messageId = makeMessageId(host);

  try {
    await mailer.sendMail({
      from,
      to: toList,
      replyTo: REPLY_TO,
      subject,
      text: body,
      html: plainToHtml(body),
      messageId,
    });
  } catch (err) {
    logger.error("[mailbox] send new message failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "SMTP odeslání selhalo. Zkontroluj logy." };
  }

  const now = new Date();
  const db = await getDb();
  const thread = await db.emailThread.create({
    data: {
      subject,
      participants: JSON.stringify(Array.from(new Set([fromAddr, ...toList]))),
      lastMessageAt: now,
      messageCount: 1,
      unreadCount: 0,
      messages: {
        create: {
          messageId,
          direction: "outbound",
          fromAddress: fromAddr,
          fromName: "Janička",
          toAddresses: JSON.stringify(toList),
          ccAddresses: "[]",
          subject,
          bodyText: body,
          bodyHtml: plainToHtml(body),
          receivedAt: now,
          readAt: now,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/admin/mailbox");
  revalidateTag("admin-mailbox", "max");
  redirect(`/admin/mailbox/${thread.id}`);
}
