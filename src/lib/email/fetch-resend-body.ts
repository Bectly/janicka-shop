import { logger } from "@/lib/logger";

interface ResendEmailGetResponse {
  id?: string;
  text?: string | null;
  html?: string | null;
  headers?: Record<string, string> | Array<{ name: string; value: string }> | null;
}

export interface ResendBody {
  text: string | null;
  html: string | null;
  headersRaw: string | null;
}

/**
 * Fetches the full body of a Resend-tracked email by its internal UUID.
 *
 * Resend's Inbound webhook (2025+) delivers metadata only — body text/html and
 * full headers are omitted. Calling GET /emails/:id after persistence backfills
 * those fields. Returns null on any error (network, non-OK status, malformed
 * JSON) so callers can fail-soft without rolling back the persisted row.
 */
export async function fetchResendEmailBody(emailId: string): Promise<ResendBody | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    logger.warn("[fetchResendEmailBody] RESEND_API_KEY not set — skipping body fetch");
    return null;
  }
  const id = emailId.trim();
  if (!id) return null;

  let res: Response;
  try {
    res = await fetch(`https://api.resend.com/emails/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logger.warn("[fetchResendEmailBody] network error", {
      emailId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (!res.ok) {
    logger.warn("[fetchResendEmailBody] non-ok response", {
      emailId: id,
      status: res.status,
    });
    return null;
  }

  let data: ResendEmailGetResponse;
  try {
    data = (await res.json()) as ResendEmailGetResponse;
  } catch (err) {
    logger.warn("[fetchResendEmailBody] invalid JSON", {
      emailId: id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  return {
    text: typeof data.text === "string" ? data.text : null,
    html: typeof data.html === "string" ? data.html : null,
    headersRaw: data.headers ? JSON.stringify(data.headers) : null,
  };
}
