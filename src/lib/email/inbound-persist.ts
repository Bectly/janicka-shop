import { createHash } from "crypto";
import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { uploadToR2 } from "@/lib/r2";
import { logger } from "@/lib/logger";

/**
 * Pipeline-agnostic inbound mail shape. Both IMAP (mailparser) and the Resend
 * webhook map their respective payloads into this struct so the persistence
 * path stays single-source-of-truth.
 */
export type InboundMail = {
  messageId: string;
  inReplyTo?: string | null;
  references?: string[];
  fromAddress: string;
  fromName?: string | null;
  toAddresses: string[];
  ccAddresses?: string[];
  subject: string;
  bodyText?: string | null;
  bodyHtml?: string | null;
  receivedAt?: Date;
  headersRaw?: string | null;
  attachments?: Array<{
    filename: string;
    contentType?: string | null;
    content: Buffer;
  }>;
};

export type PersistResult = "inserted" | "skipped";

/**
 * Idempotently store an inbound message. Dedups by messageId, threads via
 * In-Reply-To / References, uploads attachments to R2 under deterministic
 * checksum keys.
 */
export async function persistInboundMail(mail: InboundMail): Promise<PersistResult> {
  const messageId = mail.messageId.trim();
  if (!messageId) return "skipped";

  const db = await getDb();
  const existing = await db.emailMessage.findUnique({ where: { messageId } });
  if (existing) return "skipped";

  const inReplyTo = mail.inReplyTo?.trim() || null;
  const referencesIds = dedupStrings(
    (mail.references ?? []).map((r) => r.trim()).filter(Boolean),
  );

  const fromAddress = mail.fromAddress.trim().toLowerCase();
  const fromName = mail.fromName?.trim() || null;
  const toAddresses = dedupStrings(
    mail.toAddresses.map((a) => a.trim().toLowerCase()).filter(Boolean),
  );
  const ccAddresses = dedupStrings(
    (mail.ccAddresses ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean),
  );
  const subject = (mail.subject || "(bez předmětu)").slice(0, 500);
  const receivedAt = mail.receivedAt ?? new Date();

  let threadId: string | null = null;
  if (inReplyTo) {
    const parent = await db.emailMessage.findUnique({
      where: { messageId: inReplyTo },
      select: { threadId: true },
    });
    if (parent) threadId = parent.threadId;
  }
  if (!threadId && referencesIds.length > 0) {
    const ref = await db.emailMessage.findFirst({
      where: { messageId: { in: referencesIds } },
      select: { threadId: true },
    });
    if (ref) threadId = ref.threadId;
  }

  const participants = dedupStrings([fromAddress, ...toAddresses, ...ccAddresses]);

  if (!threadId) {
    const thread = await db.emailThread.create({
      data: {
        subject: stripReplyPrefix(subject),
        participants: JSON.stringify(participants),
        lastMessageAt: receivedAt,
        messageCount: 0,
        unreadCount: 0,
      },
      select: { id: true },
    });
    threadId = thread.id;
  }

  const attachmentsData: Array<{
    filename: string;
    contentType: string;
    sizeBytes: number;
    r2Key: string;
    checksumSha256: string;
  }> = [];
  for (const att of mail.attachments ?? []) {
    if (!att.content || !att.filename) continue;
    try {
      const buf = att.content;
      const checksum = createHash("sha256").update(buf).digest("hex");
      const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
      const explicitKey = `mailbox/${checksum}-${safeName}`;
      const { key } = await uploadToR2(
        buf,
        safeName,
        att.contentType ?? "application/octet-stream",
        "mailbox",
        explicitKey,
      );
      attachmentsData.push({
        filename: att.filename.slice(0, 255),
        contentType: (att.contentType ?? "application/octet-stream").slice(0, 120),
        sizeBytes: buf.length,
        r2Key: key,
        checksumSha256: checksum,
      });
    } catch (err) {
      logger.error("[inbound-persist] attachment upload failed", {
        filename: att.filename,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await db.emailMessage.create({
    data: {
      threadId,
      messageId,
      inReplyTo,
      referencesIds: referencesIds.length ? JSON.stringify(referencesIds) : null,
      direction: "inbound",
      fromAddress,
      fromName,
      toAddresses: JSON.stringify(toAddresses),
      ccAddresses: JSON.stringify(ccAddresses),
      subject,
      bodyText: mail.bodyText ?? null,
      bodyHtml: mail.bodyHtml ?? null,
      headersRaw: mail.headersRaw ?? null,
      receivedAt,
      attachments: attachmentsData.length
        ? { create: attachmentsData }
        : undefined,
    },
  });

  const existingThread = await db.emailThread.findUnique({
    where: { id: threadId },
    select: { participants: true },
  });
  const existingParticipants: string[] = existingThread?.participants
    ? safeParseList(existingThread.participants)
    : [];
  const mergedParticipants = dedupStrings([...existingParticipants, ...participants]);

  await db.emailThread.update({
    where: { id: threadId },
    data: {
      lastMessageAt: receivedAt,
      messageCount: { increment: 1 },
      unreadCount: { increment: 1 },
      participants: JSON.stringify(mergedParticipants),
      // Inbound on a previously-archived thread should resurface it.
      archived: false,
    },
  });

  return "inserted";
}

/**
 * Drop the cached admin badge + mailbox listing so newly-inserted mail shows
 * up on the next admin nav. Safe to call outside a request scope (no-op on
 * failure — TTL still kicks in).
 */
export function bumpMailboxBadges(): void {
  try {
    revalidateTag("admin-badges", "max");
    revalidateTag("admin-mailbox", "max");
  } catch {
    // revalidateTag isn't always callable outside a request; non-fatal.
  }
}

function dedupStrings(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

function stripReplyPrefix(subject: string): string {
  return subject.replace(/^(re|fwd|fw):\s*/i, "").trim() || "(bez předmětu)";
}

function safeParseList(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
