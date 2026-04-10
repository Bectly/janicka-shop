import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getDb } from "@/lib/db";
import { rateLimitLogin, recordLoginFailure } from "@/lib/rate-limit";
import { authConfig } from "@/lib/auth-config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
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

        // Dynamic import to avoid bundling bcryptjs on client
        const { compare } = await import("bcryptjs");

        // Always run bcrypt compare to prevent timing-based user enumeration.
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
});
