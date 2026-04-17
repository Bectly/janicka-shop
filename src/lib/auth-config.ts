import type { NextAuthConfig } from "next-auth";

// Edge-safe auth config — NO Prisma, NO bcrypt, NO DB imports
// Used by middleware for JWT-based route protection only
export const authConfig: NextAuthConfig = {
  providers: [], // Providers are added in auth.ts (Node.js only)
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.role = (user as { role?: "admin" | "customer" }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? "";
        session.user.role = (token.role as "admin" | "customer") ?? "customer";
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role;
      const path = nextUrl.pathname;
      const isAdmin = path.startsWith("/admin");
      const isAdminLogin = path === "/admin/login";
      const isAccount = path.startsWith("/account");
      const isCustomerLogin = path === "/login";

      if (isAdminLogin) {
        if (isLoggedIn && role === "admin") {
          return Response.redirect(new URL("/admin/dashboard", nextUrl));
        }
        return true;
      }

      if (isCustomerLogin) {
        if (isLoggedIn && role === "customer") {
          return Response.redirect(new URL("/account", nextUrl));
        }
        return true;
      }

      if (isAdmin) {
        return isLoggedIn && role === "admin";
      }

      if (isAccount) {
        return isLoggedIn && role === "customer";
      }

      return true;
    },
  },
};
