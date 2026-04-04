"use server";

import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimitAdmin } from "@/lib/rate-limit";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function toggleSubscriberActive(id: string, active: boolean) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  await db.newsletterSubscriber.update({
    where: { id },
    data: { active },
  });
}

export async function getSubscribersCsv(): Promise<string> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  const subscribers = await db.newsletterSubscriber.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });

  const header = "email,first_name,preferred_sizes,preferred_categories,preferred_brands,source,subscribed_at";
  const rows = subscribers.map(
    (s) =>
      `${csvField(s.email)},${csvField(s.firstName ?? "")},${csvField(s.preferredSizes)},${csvField(s.preferredCategories)},${csvField(s.preferredBrands)},${csvField(s.source)},${s.createdAt.toISOString()}`,
  );
  // BOM for Excel UTF-8 recognition (matching orders CSV export)
  return "\uFEFF" + [header, ...rows].join("\n");
}

function csvField(value: string): string {
  const needsFormulaGuard =
    value.length > 0 &&
    (value[0] === "=" ||
      value[0] === "+" ||
      value[0] === "-" ||
      value[0] === "@" ||
      value[0] === "\t" ||
      value[0] === "\r");
  const safe = needsFormulaGuard ? "'" + value : value;
  if (
    safe.includes(",") ||
    safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r")
  ) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
