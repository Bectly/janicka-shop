import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";
import {
  bumpMailboxBadges,
  persistInboundMail,
  type InboundMail,
} from "@/lib/email/inbound-persist";

/**
 * Resend inbound email webhook.
 *
 * Resend signs webhooks with the Svix protocol — three headers
 * (`svix-id`, `svix-timestamp`, `svix-signature`) and an HMAC-SHA256 over
 * `${id}.${timestamp}.${body}` with the dashboard-provisioned `whsec_…` secret
 * (the part after `whsec_` is base64-encoded).
 *
 * We accept event types `email.received` (inbound) and the bounce/complaint
 * variants are ignored here (status-only events have no body to thread).
 *
 * Setup checklist (bectly action — DNS gated):
 *   1. Resend dashboard → Domains → janickashop.cz → Inbound enable
 *   2. Add MX records to Cloudflare per Resend docs
 *   3. Resend dashboard → Webhooks → add endpoint
 *      `https://janickashop.cz/api/email/inbound`, copy `whsec_…` secret
 *   4. Set `RESEND_INBOUND_SECRET` in Vercel env (production + preview)
 *
 * Until DNS lands the route still verifies + parses correctly so the rest of
 * the pipeline (admin inbox UI) stays exercise-able with manual cURL of the
 * Resend test payload.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_INBOUND_SECRET?.trim();
  if (!secret) {
    logger.warn("[email-inbound] RESEND_INBOUND_SECRET not set — rejecting");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await req.text();

  if (!verifySvixSignature({ secret, id: svixId, timestamp: svixTimestamp, body, signatureHeader: svixSignature })) {
    logger.warn("[email-inbound] signature mismatch", { svixId });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Replay window: Svix recommends rejecting events older than 5 minutes.
  const tsSec = Number(svixTimestamp);
  if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > 5 * 60) {
    return NextResponse.json({ error: "Stale timestamp" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload as { type?: string; data?: unknown; created_at?: string };
  if (event?.type !== "email.received" && event?.type !== "inbound.email") {
    // Acknowledge other event types (e.g. delivery/bounce) so Resend doesn't retry.
    return NextResponse.json({ ok: true, ignored: event?.type ?? "unknown" });
  }

  const mail = mapResendInbound(event.data);
  if (!mail) {
    logger.warn("[email-inbound] could not map payload to InboundMail", { svixId });
    return NextResponse.json({ error: "Unsupported payload shape" }, { status: 422 });
  }

  try {
    const result = await persistInboundMail(mail);
    if (result === "inserted") bumpMailboxBadges();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    logger.error("[email-inbound] persist failed", {
      svixId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Verify a Svix-format signature header.
 *
 * Header format: space-separated `v1,base64sig` pairs (Svix may rotate keys
 * and send multiple). Match if any pair verifies.
 */
function verifySvixSignature(args: {
  secret: string;
  id: string;
  timestamp: string;
  body: string;
  signatureHeader: string;
}): boolean {
  const { secret, id, timestamp, body, signatureHeader } = args;
  const stripped = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(stripped, "base64");
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const signedPayload = `${id}.${timestamp}.${body}`;
  const expected = createHmac("sha256", key).update(signedPayload).digest();

  const candidates = signatureHeader
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const cand of candidates) {
    const idx = cand.indexOf(",");
    if (idx < 0) continue;
    const version = cand.slice(0, idx);
    if (version !== "v1") continue;
    const sigB64 = cand.slice(idx + 1);
    let provided: Buffer;
    try {
      provided = Buffer.from(sigB64, "base64");
    } catch {
      continue;
    }
    if (provided.length !== expected.length) continue;
    if (timingSafeEqual(provided, expected)) return true;
  }
  return false;
}

/**
 * Map Resend's inbound event payload into the pipeline-agnostic InboundMail
 * shape. Resend's payload is loosely documented — this stays defensive about
 * field shapes (string vs object, single vs array) so we don't 500 on minor
 * schema drift.
 */
function mapResendInbound(data: unknown): InboundMail | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  // Some payloads nest under `data.email`, others put it directly on `data`.
  const root: Record<string, unknown> =
    d.email && typeof d.email === "object" ? (d.email as Record<string, unknown>) : d;

  const headersIndex = buildHeaderIndex(root.headers);
  const messageId =
    asString(root.message_id) ??
    asString(root.messageId) ??
    headersIndex["message-id"] ??
    asString(root.id);
  if (!messageId) return null;

  const fromObj = parseEmailField(root.from);
  if (!fromObj || !fromObj.address) return null;

  const toAddresses = parseEmailList(root.to);
  if (toAddresses.length === 0) return null;

  const subject = asString(root.subject) ?? "(bez předmětu)";
  const bodyText = asString(root.text) ?? null;
  const bodyHtml = asString(root.html) ?? null;
  const inReplyTo = headersIndex["in-reply-to"] ?? asString(root.in_reply_to) ?? null;

  const references = collectReferences(headersIndex["references"], root.references);

  const receivedAt = parseDate(root.created_at ?? root.received_at ?? root.date);

  const attachments: InboundMail["attachments"] = [];
  for (const att of asArray(root.attachments)) {
    const filename = asString((att as Record<string, unknown>).filename);
    if (!filename) continue;
    const contentType =
      asString((att as Record<string, unknown>).content_type) ??
      asString((att as Record<string, unknown>).contentType);
    const contentB64 = asString((att as Record<string, unknown>).content);
    if (!contentB64) continue; // URL-only attachments deferred (would require fetch)
    let buf: Buffer;
    try {
      buf = Buffer.from(contentB64, "base64");
    } catch {
      continue;
    }
    attachments.push({ filename, contentType, content: buf });
  }

  return {
    messageId: ensureAngleBrackets(messageId),
    inReplyTo: inReplyTo ? ensureAngleBrackets(inReplyTo) : null,
    references: references.map(ensureAngleBrackets),
    fromAddress: fromObj.address,
    fromName: fromObj.name,
    toAddresses: toAddresses.map((a) => a.address),
    ccAddresses: parseEmailList(root.cc).map((a) => a.address),
    subject,
    bodyText,
    bodyHtml,
    headersRaw: root.headers ? JSON.stringify(root.headers) : null,
    receivedAt,
    attachments,
  };
}

function buildHeaderIndex(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (!h || typeof h !== "object") continue;
      const name = asString((h as Record<string, unknown>).name);
      const value = asString((h as Record<string, unknown>).value);
      if (name && value) out[name.toLowerCase()] = value;
    }
  } else if (headers && typeof headers === "object") {
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      const value = asString(v);
      if (value) out[k.toLowerCase()] = value;
    }
  }
  return out;
}

function parseEmailField(v: unknown): { address: string; name: string | null } | null {
  if (!v) return null;
  if (typeof v === "string") {
    return parseEmailString(v);
  }
  if (Array.isArray(v)) {
    return parseEmailField(v[0]);
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const address = asString(obj.email) ?? asString(obj.address);
    if (!address) return null;
    return { address: address.toLowerCase(), name: asString(obj.name) ?? null };
  }
  return null;
}

function parseEmailList(v: unknown): Array<{ address: string; name: string | null }> {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((item) => parseEmailField(item))
      .filter((x): x is { address: string; name: string | null } => !!x);
  }
  if (typeof v === "string") {
    // Comma/semicolon-separated header form.
    return v
      .split(/[,;]/)
      .map((p) => parseEmailString(p.trim()))
      .filter((x): x is { address: string; name: string | null } => !!x);
  }
  const single = parseEmailField(v);
  return single ? [single] : [];
}

function parseEmailString(raw: string): { address: string; name: string | null } | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
  if (m) {
    const address = m[2].trim().toLowerCase();
    if (!address) return null;
    const name = m[1].trim() || null;
    return { address, name };
  }
  if (!s.includes("@")) return null;
  return { address: s.toLowerCase(), name: null };
}

function collectReferences(headerVal: string | undefined, fieldVal: unknown): string[] {
  const out: string[] = [];
  if (headerVal) {
    out.push(...headerVal.split(/\s+/).map((r) => r.trim()).filter(Boolean));
  }
  if (Array.isArray(fieldVal)) {
    for (const v of fieldVal) {
      const s = asString(v);
      if (s) out.push(s);
    }
  } else if (typeof fieldVal === "string") {
    out.push(...fieldVal.split(/\s+/).map((r) => r.trim()).filter(Boolean));
  }
  return Array.from(new Set(out));
}

function ensureAngleBrackets(id: string): string {
  const t = id.trim();
  if (!t) return t;
  if (t.startsWith("<") && t.endsWith(">")) return t;
  return `<${t.replace(/^[<\s]+|[>\s]+$/g, "")}>`;
}

function parseDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
