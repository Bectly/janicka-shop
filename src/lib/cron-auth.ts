import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time Bearer token check against CRON_SECRET.
 * Returns a 401 response when auth fails, or null when the request is authorized.
 * Callers should early-return on non-null.
 *
 * Fail-closed: if CRON_SECRET is not configured, all requests are denied.
 */
export function requireCronSecret(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  const expectedBuf = Buffer.from(expected, "utf8");
  const tokenBuf = Buffer.from(token, "utf8");

  // timingSafeEqual requires equal-length buffers; length mismatch is an
  // immediate fail, but we still hash through a constant-time compare on a
  // padded buffer so callers can't distinguish "wrong length" from "wrong
  // value" via timing.
  if (tokenBuf.length !== expectedBuf.length) {
    const pad = Buffer.alloc(expectedBuf.length);
    timingSafeEqual(pad, expectedBuf);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!timingSafeEqual(tokenBuf, expectedBuf)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
