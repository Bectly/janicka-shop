import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const s = process.env.UNSUBSCRIBE_HMAC_SECRET;
  if (!s) throw new Error("UNSUBSCRIBE_HMAC_SECRET env var not set");
  return s;
}

export function signUnsubscribeToken(email: string): string {
  const payload = Buffer.from(email.toLowerCase()).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  if (!token || typeof token !== "string" || token.length > 512) return null;
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  try {
    const expectedSig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
