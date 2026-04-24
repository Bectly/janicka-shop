import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "devchat_widget";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecret(): string {
  const s = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET not configured");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function issueWidgetToken(): { value: string; maxAge: number } {
  const ts = Date.now().toString();
  const sig = sign(ts);
  return { value: `${ts}.${sig}`, maxAge: MAX_AGE_SECONDS };
}

export function verifyWidgetToken(value: string | undefined): boolean {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot < 1) return false;
  const ts = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  if (Date.now() - tsNum > MAX_AGE_SECONDS * 1000) return false;
  return safeEq(sig, sign(ts));
}

export async function hasWidgetCookie(): Promise<boolean> {
  const c = await cookies();
  return verifyWidgetToken(c.get(COOKIE_NAME)?.value);
}

export const WIDGET_COOKIE_NAME = COOKIE_NAME;

export function checkWidgetPassword(password: string): boolean {
  const expected = process.env.DEVCHAT_PASSWORD ?? "janicka123";
  if (password.length !== expected.length) {
    createHmac("sha256", "_").update(password).digest();
    return false;
  }
  return safeEq(password, expected);
}
