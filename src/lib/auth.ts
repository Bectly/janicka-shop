import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { rateLimitLogin, recordLoginFailure } from "@/lib/rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Přihlášení",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Heslo", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Rate limit: 5 attempts per 15 minutes per IP
        const rl = await rateLimitLogin();
        if (!rl.success) return null;

        const admin = await prisma.admin.findUnique({
          where: { email: credentials.email as string },
        });

        // Dynamic import to avoid bundling bcryptjs on client
        const { compare } = await import("bcryptjs");

        // Always run bcrypt compare to prevent timing-based user enumeration.
        // Without this, non-existent users return instantly (~0ms) vs real users (~100-200ms),
        // letting attackers determine which emails are registered.
        const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWX.Z";
        const isValid = await compare(
          credentials.password as string,
          admin?.password ?? DUMMY_HASH
        );

        if (!admin || !isValid) {
          await recordLoginFailure();
          return null;
        }

        return {
          id: admin.id,
          email: admin.email,
          name: admin.name,
        };
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdmin = nextUrl.pathname.startsWith("/admin");
      const isLoginPage = nextUrl.pathname === "/admin/login";

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/admin/dashboard", nextUrl));
        }
        return true;
      }

      if (isAdmin) {
        return isLoggedIn;
      }

      return true;
    },
  },
});
