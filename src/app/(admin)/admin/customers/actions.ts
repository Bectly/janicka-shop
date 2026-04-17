"use server";

import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { rateLimitAdmin } from "@/lib/rate-limit";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

/** Escape a CSV field with formula-injection guard and quoting. */
function csvField(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  const needsFormulaGuard =
    str.length > 0 &&
    (str[0] === "=" ||
      str[0] === "+" ||
      str[0] === "-" ||
      str[0] === "@" ||
      str[0] === "\t" ||
      str[0] === "\r");
  const safe = needsFormulaGuard ? "'" + str : str;
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

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((t): t is string => typeof t === "string");
  } catch {
    return [];
  }
}

/** Update admin-only internal note on a customer. Max 2000 chars. */
export async function updateCustomerNote(
  customerId: string,
  text: string,
): Promise<void> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const trimmed = text.trim().slice(0, 2000);

  const db = await getDb();
  await db.customer.update({
    where: { id: customerId },
    data: { internalNote: trimmed || null },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
}

/** Update admin-managed tag list on a customer. */
export async function updateCustomerTags(
  customerId: string,
  tags: string[],
): Promise<void> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  if (!Array.isArray(tags)) throw new Error("Neplatný seznam tagů");

  // Normalize: trim, drop empty, dedupe (case-insensitive key), max 20 tags, max 32 chars each
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const t = raw.trim().slice(0, 32);
    if (!t) continue;
    const key = t.toLocaleLowerCase("cs-CZ");
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(t);
    if (normalized.length >= 20) break;
  }

  const db = await getDb();
  await db.customer.update({
    where: { id: customerId },
    data: { tags: JSON.stringify(normalized) },
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
}

/** Export filtered customer list (email, name, orders, total spent, tags) as CSV. */
export async function exportCustomersCsv(
  q?: string,
  tag?: string,
): Promise<string> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();

  const where: Record<string, unknown> = {};
  const query = q?.trim();
  if (query) {
    where.OR = [
      { email: { contains: query } },
      { firstName: { contains: query } },
      { lastName: { contains: query } },
    ];
  }
  if (tag && tag.trim()) {
    where.tags = { contains: `"${tag.trim()}"` };
  }

  const customers = await db.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: {
      orders: {
        select: { total: true, status: true, orderNumber: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const header = [
    "Email",
    "Jméno",
    "Příjmení",
    "Telefon",
    "Město",
    "PSČ",
    "Objednávky",
    "Utraceno",
    "Poslední objednávka",
    "Poslední status",
    "Tagy",
    "Registrace",
  ];

  const rows = customers.map((c) => {
    const valid = c.orders.filter((o) => o.status !== "cancelled");
    const totalSpent = valid.reduce((sum, o) => sum + o.total, 0);
    const last = c.orders[0];
    const tags = parseTags(c.tags);
    const date = new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).format(c.createdAt);

    return [
      c.email,
      c.firstName,
      c.lastName,
      c.phone ?? "",
      c.city ?? "",
      c.zip ?? "",
      c.orders.length,
      totalSpent,
      last?.orderNumber ?? "",
      last ? (ORDER_STATUS_LABELS[last.status] ?? last.status) : "",
      tags.join("; "),
      date,
    ];
  });

  const csv =
    header.map(csvField).join(",") +
    "\n" +
    rows.map((row) => row.map(csvField).join(",")).join("\n");

  return "\uFEFF" + csv;
}
