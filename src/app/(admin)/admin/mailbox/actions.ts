"use server";

import { randomBytes } from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { getDb } from "@/lib/db";
import { getMailer } from "@/lib/email/resend-transport";
import {
  FROM_INFO,
  FROM_ORDERS,
  FROM_SUPPORT,
  REPLY_TO,
} from "@/lib/email/addresses";
import { logger } from "@/lib/logger";
import { formatDate } from "@/lib/format";

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
  const header = `Dne ${formatDate(latestReceivedAt)} ${sender} napsal(a):`;
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
      error: "E-mailová služba není nakonfigurovaná — nastav RESEND_API_KEY.",
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
    return { ok: false, error: "Odeslání e-mailu selhalo. Zkontroluj logy." };
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
      error: "E-mailová služba není nakonfigurovaná — nastav RESEND_API_KEY.",
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
    return { ok: false, error: "Odeslání e-mailu selhalo. Zkontroluj logy." };
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

// --- Phase B: drafts (task #1032) ---

export type DraftInput = {
  id?: string;
  threadId?: string | null;
  inReplyToId?: string | null;
  fromAlias: string;
  toAddresses?: string[];
  ccAddresses?: string[];
  bccAddresses?: string[];
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  attachmentR2Keys?: string[];
};

type DraftRow = {
  id: string;
  threadId: string | null;
  inReplyToId: string | null;
  fromAlias: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  attachmentR2Keys: string[];
  updatedAt: Date;
  createdAt: Date;
};

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

/**
 * Upsert a draft for the current admin. Pass `id` to update an existing draft;
 * omit `id` to create a new one. Body is stored both as HTML and plain text so
 * the preview stays accessible when the rich editor is offline.
 */
export async function saveEmailDraftAction(input: DraftInput): Promise<{ id: string }> {
  const session = await requireAdmin();
  const authorId = session.user?.id;
  if (!authorId) throw new Error("Unauthorized");

  if (typeof input?.fromAlias !== "string" || !input.fromAlias.trim()) {
    throw new Error("fromAlias is required");
  }

  const data = {
    threadId: input.threadId ?? null,
    inReplyToId: input.inReplyToId ?? null,
    fromAlias: input.fromAlias.trim().toLowerCase(),
    toAddresses: JSON.stringify(toStringArray(input.toAddresses)),
    ccAddresses: JSON.stringify(toStringArray(input.ccAddresses)),
    bccAddresses: JSON.stringify(toStringArray(input.bccAddresses)),
    subject: typeof input.subject === "string" ? input.subject : "",
    bodyHtml: typeof input.bodyHtml === "string" ? input.bodyHtml : "",
    bodyText: typeof input.bodyText === "string" ? input.bodyText : "",
    attachmentR2Keys: JSON.stringify(toStringArray(input.attachmentR2Keys)),
    authorId,
  };

  const db = await getDb();
  if (input.id && typeof input.id === "string") {
    const existing = await db.emailDraft.findUnique({ where: { id: input.id } });
    if (!existing) throw new Error("Draft not found");
    if (existing.authorId !== authorId) throw new Error("Forbidden");
    const updated = await db.emailDraft.update({
      where: { id: input.id },
      data,
      select: { id: true },
    });
    revalidatePath("/admin/mailbox");
    return { id: updated.id };
  }

  const created = await db.emailDraft.create({ data, select: { id: true } });
  revalidatePath("/admin/mailbox");
  return { id: created.id };
}

export async function deleteEmailDraftAction(id: string): Promise<void> {
  const session = await requireAdmin();
  const authorId = session.user?.id;
  if (!authorId) throw new Error("Unauthorized");
  if (typeof id !== "string" || !id) return;

  const db = await getDb();
  const existing = await db.emailDraft.findUnique({ where: { id } });
  if (!existing) return;
  if (existing.authorId !== authorId) throw new Error("Forbidden");

  await db.emailDraft.delete({ where: { id } });
  revalidatePath("/admin/mailbox");
}

export async function listEmailDraftsAction(opts?: {
  threadId?: string;
  limit?: number;
}): Promise<DraftRow[]> {
  const session = await requireAdmin();
  const authorId = session.user?.id;
  if (!authorId) throw new Error("Unauthorized");

  const db = await getDb();
  const where: { authorId: string; threadId?: string } = { authorId };
  if (opts?.threadId) where.threadId = opts.threadId;

  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const rows = await db.emailDraft.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    threadId: r.threadId,
    inReplyToId: r.inReplyToId,
    fromAlias: r.fromAlias,
    toAddresses: parseJsonList(r.toAddresses),
    ccAddresses: parseJsonList(r.ccAddresses),
    bccAddresses: parseJsonList(r.bccAddresses),
    subject: r.subject,
    bodyHtml: r.bodyHtml,
    bodyText: r.bodyText,
    attachmentR2Keys: parseJsonList(r.attachmentR2Keys),
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
  }));
}

// --- Phase B: labels CRUD + thread assignment (task #1038) ---

export type LabelRow = {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function normalizeLabelName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 60);
}

function normalizeLabelColor(raw: unknown, fallback = "#9CA3AF"): string {
  if (typeof raw !== "string") return fallback;
  const v = raw.trim();
  return HEX_COLOR.test(v) ? v : fallback;
}

export async function listLabelsAction(): Promise<LabelRow[]> {
  await requireAdmin();
  const db = await getDb();
  const rows = await db.emailLabel.findMany({ orderBy: { name: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    createdAt: r.createdAt,
  }));
}

export async function createLabelAction(input: {
  name: string;
  color?: string;
}): Promise<{ id: string }> {
  await requireAdmin();
  const name = normalizeLabelName(input?.name);
  if (!name) throw new Error("Název štítku je povinný.");
  const color = normalizeLabelColor(input?.color);

  const db = await getDb();
  const existing = await db.emailLabel.findUnique({ where: { name } });
  if (existing) throw new Error("Štítek s tímto názvem už existuje.");

  const created = await db.emailLabel.create({
    data: { name, color },
    select: { id: true },
  });
  revalidatePath("/admin/mailbox");
  revalidateTag("admin-mailbox", "max");
  return { id: created.id };
}

export async function updateLabelAction(input: {
  id: string;
  name: string;
  color?: string;
}): Promise<void> {
  await requireAdmin();
  if (typeof input?.id !== "string" || !input.id) {
    throw new Error("Chybí id štítku.");
  }
  const name = normalizeLabelName(input?.name);
  if (!name) throw new Error("Název štítku je povinný.");
  const color = normalizeLabelColor(input?.color);

  const db = await getDb();
  const clash = await db.emailLabel.findFirst({
    where: { name, NOT: { id: input.id } },
    select: { id: true },
  });
  if (clash) throw new Error("Štítek s tímto názvem už existuje.");

  await db.emailLabel.update({
    where: { id: input.id },
    data: { name, color },
  });
  revalidatePath("/admin/mailbox");
  revalidateTag("admin-mailbox", "max");
}

export async function deleteLabelAction(id: string): Promise<void> {
  await requireAdmin();
  if (typeof id !== "string" || !id) return;
  const db = await getDb();
  // Cascade on EmailThreadLabel handles the join rows.
  await db.emailLabel.delete({ where: { id } }).catch(() => {
    /* idempotent: already gone */
  });
  revalidatePath("/admin/mailbox");
  revalidateTag("admin-mailbox", "max");
}

/**
 * Replace the full label set for a thread. `labelIds` is the desired final
 * set — server diffs against existing rows and applies adds/removes in one
 * transaction so the picker stays atomic.
 */
export async function setThreadLabelsAction(
  threadId: string,
  labelIds: string[],
): Promise<void> {
  await requireAdmin();
  if (typeof threadId !== "string" || !threadId) {
    throw new Error("Chybí identifikátor konverzace.");
  }
  const desired = Array.from(
    new Set(toStringArray(labelIds).filter((id) => id.length > 0)),
  );

  const db = await getDb();
  const thread = await db.emailThread.findUnique({
    where: { id: threadId },
    select: { id: true },
  });
  if (!thread) throw new Error("Konverzace nenalezena.");

  if (desired.length > 0) {
    const valid = await db.emailLabel.findMany({
      where: { id: { in: desired } },
      select: { id: true },
    });
    if (valid.length !== desired.length) {
      throw new Error("Některý štítek neexistuje.");
    }
  }

  const existing = await db.emailThreadLabel.findMany({
    where: { threadId },
    select: { labelId: true },
  });
  const existingIds = new Set(existing.map((r) => r.labelId));
  const desiredSet = new Set(desired);
  const toAdd = desired.filter((id) => !existingIds.has(id));
  const toRemove = [...existingIds].filter((id) => !desiredSet.has(id));

  await db.$transaction([
    ...(toRemove.length > 0
      ? [
          db.emailThreadLabel.deleteMany({
            where: { threadId, labelId: { in: toRemove } },
          }),
        ]
      : []),
    ...toAdd.map((labelId) =>
      db.emailThreadLabel.create({ data: { threadId, labelId } }),
    ),
  ]);

  revalidatePath("/admin/mailbox");
  revalidatePath(`/admin/mailbox/${threadId}`);
  revalidateTag("admin-mailbox", "max");
}
