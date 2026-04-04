"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function toggleSubscriberActive(id: string, active: boolean) {
  await requireAdmin();
  await prisma.newsletterSubscriber.update({
    where: { id },
    data: { active },
  });
}

export async function getSubscribersCsv(): Promise<string> {
  await requireAdmin();
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });

  const header = "email,subscribed_at";
  const rows = subscribers.map(
    (s) => `${s.email},${s.createdAt.toISOString()}`,
  );
  return [header, ...rows].join("\n");
}
