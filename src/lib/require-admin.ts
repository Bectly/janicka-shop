import type { Session } from "next-auth";
import { auth } from "@/lib/auth";

export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return session;
}
