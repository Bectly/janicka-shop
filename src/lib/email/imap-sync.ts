import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { uploadToR2 } from "@/lib/r2";
import { logger } from "@/lib/logger";
import { createHash } from "crypto";

type Prisma = Awaited<ReturnType<typeof getDb>>;

type SyncResult = {
  ok: boolean;
  fetched: number;
  inserted: number;
  skipped: number;
  failed: number;
  error?: string;
};

/**
 * Pull new messages from an IMAP INBOX, parse them, dedup by Message-ID,
 * thread via In-Reply-To / References, and persist to EmailThread + EmailMessage.
 * Returns early with ok=false when IMAP_* env vars are missing (feature-flagged
 * until bectly provisions mailhosting).
 *
 * Expected env:
 *   IMAP_HOST, IMAP_PORT (default 993), IMAP_USER, IMAP_PASSWORD
 *   IMAP_MAILBOX (default "INBOX"), IMAP_SECURE (default "true")
 *   IMAP_BATCH_LIMIT (default 50)
 */
export async function syncImapInbox(): Promise<SyncResult> {
  const host = process.env.IMAP_HOST?.trim();
  const user = process.env.IMAP_USER?.trim();
  const pass = process.env.IMAP_PASSWORD?.trim();
  if (!host || !user || !pass) {
    logger.warn("[imap-sync] IMAP_HOST/IMAP_USER/IMAP_PASSWORD not set — skip");
    return { ok: false, fetched: 0, inserted: 0, skipped: 0, failed: 0, error: "imap_disabled" };
  }

  const port = Number((process.env.IMAP_PORT ?? "993").trim());
  const secure = (process.env.IMAP_SECURE?.trim() ?? "true") !== "false";
  const mailbox = process.env.IMAP_MAILBOX?.trim() ?? "INBOX";
  const batchLimit = Math.max(1, Math.min(500, Number((process.env.IMAP_BATCH_LIMIT ?? "50").trim())));

  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
  });

  const db = await getDb();
  let fetched = 0;
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock(mailbox);
    try {
      // Fetch only unseen messages. Batch-limited so cron stays snappy.
      const uids: number[] = await client.search({ seen: false }, { uid: true }) || [];
      const targetUids = uids.slice(-batchLimit);
      fetched = targetUids.length;

      for (const uid of targetUids) {
        try {
          const msg: FetchMessageObject | false = await client.fetchOne(
            String(uid),
            { source: true, envelope: true, flags: true, uid: true },
            { uid: true },
          );
          if (!msg || !msg.source) {
            failed++;
            continue;
          }
          const parsed = await simpleParser(msg.source);
          const result = await persistParsedMessage(db, parsed);
          if (result === "inserted") inserted++;
          else if (result === "skipped") skipped++;
        } catch (err) {
          failed++;
          logger.error("[imap-sync] message fetch/parse failed", {
            uid,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    try { await client.close(); } catch { /* noop */ }
    logger.error("[imap-sync] connection error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, fetched, inserted, skipped, failed, error: "imap_error" };
  }

  // Each inbound insert increments EmailThread.unreadCount, which feeds the
  // cached admin-badge trio (src/lib/admin-badges.ts). Drop the cached copy
  // so the next admin nav reflects new mail.
  if (inserted > 0) {
    try {
      revalidateTag("admin-badges", "max");
      revalidateTag("admin-mailbox", "max");
    } catch {
      // revalidateTag may not be callable outside a request scope (e.g. cron
      // wrapper). Non-fatal — TTL will still refresh the badge within minutes.
    }
  }

  return { ok: true, fetched, inserted, skipped, failed };
}

/** Persist a parsed email into EmailThread + EmailMessage, with dedup. */
async function persistParsedMessage(
  db: Prisma,
  parsed: ParsedMail,
): Promise<"inserted" | "skipped"> {
  const messageId = parsed.messageId?.trim();
  if (!messageId) {
    // RFC-compliant messages always carry Message-ID; bail on malformed ones.
    return "skipped";
  }

  const existing = await db.emailMessage.findUnique({ where: { messageId } });
  if (existing) return "skipped";

  const inReplyTo = parsed.inReplyTo?.trim() || null;
  const referencesIds = normalizeReferences(parsed.references);

  const fromAddr = firstAddress(parsed.from);
  const toAddrs = allAddresses(parsed.to);
  const ccAddrs = allAddresses(parsed.cc);
  const subject = (parsed.subject ?? "(bez předmětu)").slice(0, 500);
  const receivedAt = parsed.date ?? new Date();

  // Threading: try to locate existing thread via inReplyTo / references chain.
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

  const participants = dedupStrings([
    fromAddr.address,
    ...toAddrs.map((a) => a.address),
    ...ccAddrs.map((a) => a.address),
  ].filter(Boolean));

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

  // Upload attachments first (best-effort — failures downgrade to skipped attachments).
  const attachmentsData: Array<{
    filename: string;
    contentType: string;
    sizeBytes: number;
    r2Key: string;
    checksumSha256: string;
  }> = [];
  for (const att of parsed.attachments ?? []) {
    if (!att.content || !att.filename) continue;
    try {
      const buf = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content as Uint8Array);
      const checksum = createHash("sha256").update(buf).digest("hex");
      const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
      // Deterministic key so duplicate attachments dedupe in R2 and the stored
      // r2Key always matches the object actually written.
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
      logger.error("[imap-sync] attachment upload failed", {
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
      fromAddress: fromAddr.address,
      fromName: fromAddr.name ?? null,
      toAddresses: JSON.stringify(toAddrs.map((a) => a.address)),
      ccAddresses: JSON.stringify(ccAddrs.map((a) => a.address)),
      subject,
      bodyText: parsed.text ?? null,
      bodyHtml: typeof parsed.html === "string" ? parsed.html : null,
      headersRaw: parsed.headerLines ? JSON.stringify(parsed.headerLines) : null,
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
    ? JSON.parse(existingThread.participants)
    : [];
  const mergedParticipants = dedupStrings([
    ...existingParticipants,
    ...participants,
  ]);

  await db.emailThread.update({
    where: { id: threadId },
    data: {
      lastMessageAt: receivedAt,
      messageCount: { increment: 1 },
      unreadCount: { increment: 1 },
      participants: JSON.stringify(mergedParticipants),
    },
  });

  return "inserted";
}

function firstAddress(a: AddressObject | AddressObject[] | undefined): {
  address: string;
  name: string | null;
} {
  const arr = allAddresses(a);
  return arr[0] ?? { address: "unknown@unknown", name: null };
}

function allAddresses(
  a: AddressObject | AddressObject[] | undefined,
): Array<{ address: string; name: string | null }> {
  if (!a) return [];
  const list = Array.isArray(a) ? a : [a];
  const out: Array<{ address: string; name: string | null }> = [];
  for (const group of list) {
    for (const v of group.value ?? []) {
      if (!v.address) continue;
      out.push({
        address: v.address.toLowerCase(),
        name: v.name?.trim() || null,
      });
    }
  }
  return out;
}

function normalizeReferences(refs: string | string[] | undefined): string[] {
  if (!refs) return [];
  const arr = Array.isArray(refs) ? refs : refs.split(/\s+/);
  return dedupStrings(arr.map((r) => r.trim()).filter(Boolean));
}

function dedupStrings(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

function stripReplyPrefix(subject: string): string {
  return subject.replace(/^(re|fwd|fw):\s*/i, "").trim() || "(bez předmětu)";
}
