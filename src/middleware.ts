// Middleware runs on Edge — MUST NOT import anything that depends on @libsql/client.
// authConfig has no providers and no DB import, so it stays Edge-safe.
//
// We use NextAuth() to get a real JWT-decoding `auth()` wrapper (replaces the
// previous raw-cookie-presence check that let any logged-in user hit /admin/*),
// then enforce role-specific gates: /admin/* requires role=admin and bounces
// to /admin/login; /account/* requires role=customer and bounces to /login.
import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth-config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isLoggedIn = !!req.auth?.user;
  const role = req.auth?.user?.role;

  // /admin/login is the only public path inside our matcher
  // (/admin/:path*). Bounce already-authed admins to dashboard, otherwise
  // let it render so they can sign in.
  if (path === "/admin/login") {
    if (isLoggedIn && role === "admin") {
      return NextResponse.redirect(new URL("/admin/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  if (path.startsWith("/admin")) {
    if (!isLoggedIn || role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", nextUrl));
    }
    return NextResponse.next();
  }

  if (path.startsWith("/account")) {
    if (!isLoggedIn || role !== "customer") {
      const url = new URL("/login", nextUrl);
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/account/:path*"],
};
