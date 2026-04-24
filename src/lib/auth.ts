import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { rateLimitLogin, recordLoginFailure } from "@/lib/rate-limit";
import { authConfig } from "@/lib/auth-config";
import { logger } from "@/lib/logger";

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
          logger.error("[auth] DB connection failed:", err);
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
          logger.error("[auth] DB connection failed:", err);
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
            const newAttempts = (customer.loginAttempts ?? 0) + 1;
            const LOCK_AFTER = 10;
            const LOCK_DURATION_MS = 30 * 60 * 1000;
            await db.customer.update({
              where: { id: customer.id },
              data: {
                loginAttempts: newAttempts,
                ...(newAttempts >= LOCK_AFTER
                  ? { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) }
                  : {}),
              },
            });
            try {
              const { logEvent } = await import("@/lib/audit-log");
              await logEvent({ customerId: customer.id, action: "login_failed" });
            } catch {
              // Audit logging must not block auth.
            }
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

        try {
          const { logEvent } = await import("@/lib/audit-log");
          await logEvent({ customerId: customer.id, action: "login" });
        } catch {
          // Audit logging must not block auth.
        }

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
