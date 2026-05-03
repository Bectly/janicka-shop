import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import {
  bumpMailboxBadges,
  persistInboundMail,
  type InboundMail,
} from "@/lib/email/inbound-persist";

/**
 * Resend Inbound webhook. Receives parsed mail JSON, verifies HMAC over the
 * raw body with RESEND_INBOUND_SECRET, maps the payload onto our pipeline-
 * agnostic InboundMail, and persists via the same module the IMAP cron uses
 * (single source of truth for thread/dedup/attachment logic).
 *
 * Returns 200 quickly — Resend retries on 5xx; persist failures must not
 * block re-try cadence beyond a single attempt.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_INBOUND_SECRET?.trim();
  if (!secret) {
    logger.warn("[resend-inbound] RESEND_INBOUND_SECRET not set — rejecting");
    return NextResponse.json({ error: "inbound_disabled" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("resend-signature") ?? "";

  if (!verifySignature(rawBody, signature, secret)) {
    logger.warn("[resend-inbound] signature mismatch");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const mail = mapResendPayload(payload);
  if (!mail) {
    logger.warn("[resend-inbound] payload missing required fields");
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    const result = await persistInboundMail(mail);
    if (result === "inserted") bumpMailboxBadges();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    logger.error("[resend-inbound] persist failed", {
      messageId: mail.messageId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "persist_failed" }, { status: 500 });
  }
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const got = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  if (expected.length !== got.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(got, "hex"));
  } catch {
    return false;
  }
}

interface ResendInboundPayload {
  type?: string;
  data?: ResendInboundData;
  [key: string]: unknown;
}

interface ResendInboundData {
  from?: string | { email?: string; name?: string } | null;
  to?: string[] | string | null;
  cc?: string[] | string | null;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  headers?: Array<{ name: string; value: string }> | Record<string, string> | null;
  attachments?: Array<{
    filename?: string;
    contentType?: string | null;
    content_type?: string | null;
    content?: string | null;
    contentBase64?: string | null;
  }> | null;
  date?: string | null;
}

/**
 * Resend Inbound JSON has shifted shapes during beta — be permissive about
 * envelope (top-level vs `data`), header list vs object, single string `to`
 * vs array. Reject only when Message-ID + from are unrecoverable.
 */
function mapResendPayload(raw: unknown): InboundMail | null {
  if (!raw || typeof raw !== "object") return null;
  const env = raw as ResendInboundPayload;
  const data: ResendInboundData = (env.data ?? (raw as ResendInboundData)) || {};

  const headers = normalizeHeaders(data.headers);
  const messageId =
    headers["message-id"]?.trim() ||
    headers["message-Id"]?.trim() ||
    "";
  if (!messageId) return null;

  const fromAddr = pickFrom(data.from);
  if (!fromAddr.address) return null;

  const toAddresses = toArray(data.to).map((s) => s.toLowerCase());
  const ccAddresses = toArray(data.cc).map((s) => s.toLowerCase());

  const inReplyTo = headers["in-reply-to"]?.trim() || null;
  const referencesRaw = headers["references"];
  const references = referencesRaw
    ? referencesRaw.split(/\s+/).map((r) => r.trim()).filter(Boolean)
    : [];

  const receivedAt = data.date ? new Date(data.date) : new Date();

  const attachments: InboundMail["attachments"] = [];
  for (const att of data.attachments ?? []) {
    const filename = att.filename?.trim();
    const b64 = att.contentBase64 ?? att.content;
    if (!filename || !b64 || typeof b64 !== "string") continue;
    try {
      attachments.push({
        filename,
        contentType: att.contentType ?? att.content_type ?? null,
        content: Buffer.from(b64, "base64"),
      });
    } catch {
      // skip malformed attachments
    }
  }

  return {
    messageId,
    inReplyTo,
    references,
    fromAddress: fromAddr.address,
    fromName: fromAddr.name,
    toAddresses,
    ccAddresses,
    subject: (data.subject ?? "(bez předmětu)").slice(0, 500),
    bodyText: data.text ?? null,
    bodyHtml: typeof data.html === "string" ? data.html : null,
    headersRaw: JSON.stringify(headers),
    receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
    attachments,
  };
}

function normalizeHeaders(
  h: ResendInboundData["headers"],
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (Array.isArray(h)) {
    for (const entry of h) {
      if (entry?.name && typeof entry.value === "string") {
        out[entry.name.toLowerCase()] = entry.value;
      }
    }
    return out;
  }
  if (typeof h === "object") {
    for (const [k, v] of Object.entries(h)) {
      if (typeof v === "string") out[k.toLowerCase()] = v;
    }
  }
  return out;
}

function pickFrom(
  raw: ResendInboundData["from"],
): { address: string; name: string | null } {
  if (!raw) return { address: "", name: null };
  if (typeof raw === "string") {
    return parseRfc5322Address(raw);
  }
  return {
    address: (raw.email ?? "").trim().toLowerCase(),
    name: raw.name?.trim() || null,
  };
}

function parseRfc5322Address(raw: string): { address: string; name: string | null } {
  const angle = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (angle) {
    const name = angle[1].replace(/^"|"$/g, "").trim() || null;
    return { address: angle[2].trim().toLowerCase(), name };
  }
  return { address: raw.trim().toLowerCase(), name: null };
}

function toArray(v: string[] | string | null | undefined): string[] {
  if (!v) return [];
  const list = Array.isArray(v) ? v : v.split(/[,;]/);
  const out: string[] = [];
  for (const entry of list) {
    const parsed = parseRfc5322Address(entry);
    if (parsed.address) out.push(parsed.address);
  }
  return Array.from(new Set(out));
}
