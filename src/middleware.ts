// Middleware runs on Edge — MUST NOT import anything that depends on @libsql/client
// Import auth config directly without the Prisma dependency
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth-config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/((?!login).*)"],
};
