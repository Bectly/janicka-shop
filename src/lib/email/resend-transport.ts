import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { REPLY_TO } from "@/lib/email/addresses";

let cached: ResendMailer | null | undefined;

interface MailAttachment {
  filename?: string;
  content?: string | Buffer;
  contentType?: string;
  path?: string;
}

interface SendMailOptions {
  from: string;
  to: string | string[];
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  messageId?: string;
  inReplyTo?: string;
  references?: string | string[];
  attachments?: MailAttachment[];
}

interface SendMailResult {
  messageId: string | null;
  response: string | null;
  accepted: string[];
  rejected: string[];
}

export interface ResendMailer {
  sendMail(opts: SendMailOptions): Promise<SendMailResult>;
}

/**
 * Lazily build a singleton Resend-backed mailer.
 * Returns null when RESEND_API_KEY is missing so callers can skip gracefully —
 * email failures must never block checkout/cron flows.
 *
 * The returned interface is intentionally nodemailer-compatible (sendMail with
 * the same option shape) so call-sites stay unchanged after the SMTP→Resend
 * migration. RFC 5322 threading fields (messageId/inReplyTo/references) are
 * forwarded as headers so the mailbox reply path keeps working.
 */
export function getMailer(): ResendMailer | null {
  if (cached !== undefined) return cached;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("[resend] RESEND_API_KEY not set — emails disabled");
    cached = null;
    return null;
  }

  const client = new Resend(apiKey);

  cached = {
    async sendMail(opts) {
      const headers: Record<string, string> = { ...(opts.headers ?? {}) };
      if (opts.messageId) headers["Message-Id"] = opts.messageId;
      if (opts.inReplyTo) headers["In-Reply-To"] = opts.inReplyTo;
      if (opts.references) {
        headers["References"] = Array.isArray(opts.references)
          ? opts.references.join(" ")
          : opts.references;
      }

      const toList = Array.isArray(opts.to) ? opts.to : [opts.to];

      // Default Reply-To so customer replies hit the shared inbox we ingest
      // via the Resend Inbound webhook. Mirror the alias that the message was
      // sent from (objednavky → objednavky reply, etc.); fall back to global
      // EMAIL_REPLY_TO for senders that don't match a known alias.
      const replyTo = opts.replyTo ?? deriveReplyTo(opts.from);

      const payload = {
        from: opts.from,
        to: toList,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        replyTo,
        headers: Object.keys(headers).length ? headers : undefined,
        attachments: opts.attachments?.map((att) => ({
          filename: att.filename ?? "attachment",
          content:
            typeof att.content === "string"
              ? att.content
              : att.content instanceof Buffer
                ? att.content
                : "",
          contentType: att.contentType,
          path: att.path,
        })),
      };

      const { data, error } = await client.emails.send(
        payload as Parameters<typeof client.emails.send>[0],
      );

      if (error) {
        const msg = typeof error === "string" ? error : (error.message ?? JSON.stringify(error));
        throw new Error(`[resend] send failed: ${msg}`);
      }

      const id = data?.id ?? null;
      return {
        messageId: id,
        response: id ? `resend:${id}` : null,
        accepted: toList,
        rejected: [],
      };
    },
  };

  return cached;
}

function deriveReplyTo(from: string): string {
  const match = from.match(/<([^>]+)>/);
  const addr = (match ? match[1] : from).trim().toLowerCase();
  if (addr.endsWith("@jvsatnik.cz")) return addr;
  return REPLY_TO;
}
