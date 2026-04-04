"use server";

import { prisma } from "@/lib/db";

export async function toggleSubscriberActive(id: string, active: boolean) {
  await prisma.newsletterSubscriber.update({
    where: { id },
    data: { active },
  });
}

export async function getSubscribersCsv(): Promise<string> {
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
