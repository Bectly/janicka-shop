import { ImapFlow, type FetchMessageObject } from "imapflow";
import { simpleParser, type ParsedMail, type AddressObject } from "mailparser";
import { logger } from "@/lib/logger";
import {
  bumpMailboxBadges,
  persistInboundMail,
  type InboundMail,
} from "./inbound-persist";

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
 * thread via In-Reply-To / References, and persist via the shared
 * inbound-persist module (same target as the Resend webhook path).
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
          const mail = parsedToInbound(parsed);
          if (!mail) {
            // RFC-compliant messages always carry Message-ID; bail on malformed ones.
            skipped++;
            continue;
          }
          const result = await persistInboundMail(mail);
          if (result === "inserted") inserted++;
          else skipped++;
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

  if (inserted > 0) bumpMailboxBadges();

  return { ok: true, fetched, inserted, skipped, failed };
}

function parsedToInbound(parsed: ParsedMail): InboundMail | null {
  const messageId = parsed.messageId?.trim();
  if (!messageId) return null;

  const fromAddr = firstAddress(parsed.from);
  const toAddrs = allAddresses(parsed.to);
  const ccAddrs = allAddresses(parsed.cc);

  const attachments: InboundMail["attachments"] = [];
  for (const att of parsed.attachments ?? []) {
    if (!att.content || !att.filename) continue;
    const buf = Buffer.isBuffer(att.content)
      ? att.content
      : Buffer.from(att.content as Uint8Array);
    attachments.push({
      filename: att.filename,
      contentType: att.contentType ?? null,
      content: buf,
    });
  }

  return {
    messageId,
    inReplyTo: parsed.inReplyTo?.trim() || null,
    references: normalizeReferences(parsed.references),
    fromAddress: fromAddr.address,
    fromName: fromAddr.name,
    toAddresses: toAddrs.map((a) => a.address),
    ccAddresses: ccAddrs.map((a) => a.address),
    subject: (parsed.subject ?? "(bez předmětu)").slice(0, 500),
    bodyText: parsed.text ?? null,
    bodyHtml: typeof parsed.html === "string" ? parsed.html : null,
    headersRaw: parsed.headerLines ? JSON.stringify(parsed.headerLines) : null,
    receivedAt: parsed.date ?? new Date(),
    attachments,
  };
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
  return Array.from(new Set(arr.map((r) => r.trim()).filter(Boolean)));
}
