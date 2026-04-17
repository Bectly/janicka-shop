import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { rateLimitLogin, recordLoginFailure } from "@/lib/rate-limit";
import { authConfig } from "@/lib/auth-config";

const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWX.Z";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      name: "Přihlášení administrace",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Heslo", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const rl = await rateLimitLogin();
        if (!rl.success) return null;

        let db;
        try {
          db = await getDb();
        } catch (err) {
          console.error("[auth] DB connection failed:", err);
          throw err;
        }

        const admin = await db.admin.findUnique({
          where: { email: credentials.email as string },
        });

        const { compare } = await import("bcryptjs");
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
          role: "admin" as const,
        };
      },
    }),
    Credentials({
      id: "customer",
      name: "Přihlášení zákazníka",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Heslo", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const rl = await rateLimitLogin();
        if (!rl.success) return null;

        let db;
        try {
          db = await getDb();
        } catch (err) {
          console.error("[auth] DB connection failed:", err);
          throw err;
        }

        const customer = await db.customer.findUnique({
          where: { email: credentials.email as string },
        });

        const { compare } = await import("bcryptjs");
        const isValid = await compare(
          credentials.password as string,
          customer?.password ?? DUMMY_HASH
        );

        if (!customer || !customer.password || !isValid) {
          await recordLoginFailure();
          if (customer?.password) {
            await db.customer.update({
              where: { id: customer.id },
              data: { loginAttempts: { increment: 1 } },
            });
          }
          return null;
        }

        if (customer.deletedAt || customer.disabled) {
          return null;
        }
        if (customer.lockedUntil && customer.lockedUntil.getTime() > Date.now()) {
          return null;
        }

        await db.customer.update({
          where: { id: customer.id },
          data: { loginAttempts: 0, lastLoginAt: new Date() },
        });

        return {
          id: customer.id,
          email: customer.email,
          name: `${customer.firstName} ${customer.lastName}`.trim(),
          role: "customer" as const,
        };
      },
    }),
  ],
});
