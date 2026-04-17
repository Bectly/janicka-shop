import { NextResponse } from "next/server";
import { z } from "zod";
import {
  WIDGET_COOKIE_MAX_AGE,
  WIDGET_COOKIE_NAME,
  checkWidgetPassword,
  hasWidgetCookie,
  issueWidgetToken,
} from "@/lib/devchat-widget-auth";
import { auth } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().max(100).optional(),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  if (!checkWidgetPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Špatné heslo" }, { status: 401 });
  }

  const token = issueWidgetToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(WIDGET_COOKIE_NAME, token.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: token.maxAge,
  });
  return res;
}

export async function GET() {
  const cookieOk = await hasWidgetCookie();
  if (cookieOk) return NextResponse.json({ authenticated: true });

  const session = await auth();
  if (session?.user) return NextResponse.json({ authenticated: true });

  return NextResponse.json({ authenticated: false });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(WIDGET_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
