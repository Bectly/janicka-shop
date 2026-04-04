// Middleware runs on Edge — MUST NOT import anything that depends on @libsql/client
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip login page — always accessible
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  // Check for auth session cookie (NextAuth JWT)
  const token = request.cookies.get("authjs.session-token") ||
                request.cookies.get("__Secure-authjs.session-token");

  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
