import { randomBytes } from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
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

export type SendCategory = "support" | "orders" | "info";

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
  const joined = incomingTo.join(",").toLowerCase();
  if (joined.includes("objednavky@")) return FROM_ORDERS;
  if (joined.includes("info@")) return FROM_INFO;
  return FROM_SUPPORT;
}

function pickFromForCategory(category: SendCategory): string {
  if (category === "orders") return FROM_ORDERS;
  if (category === "info") return FROM_INFO;
  return FROM_SUPPORT;
}

function senderAddress(from: string): string {
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseRecipients(raw: string | string[]): string[] {
  const items = Array.isArray(raw) ? raw : raw.split(/[,;\s]+/);
  return items
    .map((s) => String(s).trim().toLowerCase())
    .filter((s) => EMAIL_RE.test(s));
}

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

export type ComposeInput = {
  to: string[] | string;
  subject: string;
  body: string;
  category?: SendCategory;
};

export type ComposeResult =
  | { ok: true; threadId: string }
  | { ok: false; error: string };

/**
 * Compose + send a brand-new outbound thread. Persists the EmailMessage with
 * direction='outbound' so the thread shows up in Sent and downstream replies
 * can chain via Message-ID.
 */
export async function composeAndSendEmail(input: ComposeInput): Promise<ComposeResult> {
  const toList = parseRecipients(input.to ?? "");
  if (toList.length === 0) {
    return { ok: false, error: "Zadej alespoň jednoho validního příjemce." };
  }
  const subject = String(input.subject ?? "").trim();
  if (!subject) return { ok: false, error: "Předmět nemůže být prázdný." };
  const body = String(input.body ?? "").trim();
  if (!body) return { ok: false, error: "Text zprávy nemůže být prázdný." };

  const mailer = getMailer();
  if (!mailer) {
    return {
      ok: false,
      error: "E-mailová služba není nakonfigurovaná — nastav RESEND_API_KEY.",
    };
  }

  const category: SendCategory =
    input.category === "orders" || input.category === "info" ? input.category : "support";
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
    logger.error("[mailbox] compose send failed", {
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
  return { ok: true, threadId: thread.id };
}

export type ReplyInput = {
  threadId: string;
  body: string;
};

export type ReplyResult = { ok: true } | { ok: false; error: string };

/**
 * Reply on an existing thread. Re-uses the alias the customer originally
 * wrote to, builds the RFC 5322 References chain, and persists the outbound
 * message so the thread stays continuous.
 */
export async function replyOnThread(input: ReplyInput): Promise<ReplyResult> {
  const threadId = String(input.threadId ?? "");
  if (!threadId) return { ok: false, error: "Chybí identifikátor konverzace." };
  const body = String(input.body ?? "").trim();
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
    include: { messages: { orderBy: { receivedAt: "desc" }, take: 1 } },
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
    logger.error("[mailbox] reply send failed", {
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

/** Mark every message in a thread as read and zero the thread unreadCount. */
export async function markThreadRead(threadId: string): Promise<{ ok: boolean }> {
  if (typeof threadId !== "string" || !threadId) return { ok: false };

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
  return { ok: true };
}
