import { createHmac, timingSafeEqual } from "crypto";
import { logger } from "@/lib/logger";

function getSecret(): string | null {
  return process.env.UNSUBSCRIBE_HMAC_SECRET || null;
}

let warned = false;
function warnOnce() {
  if (warned) return;
  warned = true;
  logger.error("[unsubscribe-token] UNSUBSCRIBE_HMAC_SECRET not set — unsubscribe links disabled until env var configured.");
}

export function signUnsubscribeToken(email: string): string {
  const secret = getSecret();
  if (!secret) {
    warnOnce();
    return `plain.${Buffer.from(email.toLowerCase()).toString("base64url")}`;
  }
  const payload = Buffer.from(email.toLowerCase()).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  if (!token || typeof token !== "string" || token.length > 512) return null;
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  const secret = getSecret();
  if (!secret) {
    if (payload === "plain") {
      const actualPayload = sig;
      try {
        return Buffer.from(actualPayload, "base64url").toString("utf8") || null;
      } catch {
        return null;
      }
    }
    return null;
  }
  try {
    const expectedSig = createHmac("sha256", secret).update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
