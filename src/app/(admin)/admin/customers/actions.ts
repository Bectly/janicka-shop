"use server";

import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { rateLimitAdmin } from "@/lib/rate-limit";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { logEvent } from "@/lib/audit-log";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
}

function appendAudit(existing: string | null, line: string): string {
  const stamp = new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  
          timeZone: "Europe/Prague",
        }).format(new Date());
  const entry = `[${stamp}] ${line}`;
  return existing && existing.trim() ? `${existing.trim()}\n${entry}` : entry;
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
    
          timeZone: "Europe/Prague",
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

/** Update admin-editable profile fields on a customer. */
export async function updateCustomerProfile(
  customerId: string,
  data: {
    firstName: string;
    lastName: string;
    phone?: string | null;
    street?: string | null;
    city?: string | null;
    zip?: string | null;
    country?: string | null;
  },
): Promise<void> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const firstName = data.firstName.trim().slice(0, 80);
  const lastName = data.lastName.trim().slice(0, 80);
  if (!firstName || !lastName) throw new Error("Jméno a příjmení jsou povinné.");

  const db = await getDb();
  await db.customer.update({
    where: { id: customerId },
    data: {
      firstName,
      lastName,
      phone: data.phone?.trim().slice(0, 40) || null,
      street: data.street?.trim().slice(0, 160) || null,
      city: data.city?.trim().slice(0, 80) || null,
      zip: data.zip?.trim().slice(0, 10) || null,
      country: data.country?.trim().slice(0, 2).toUpperCase() || "CZ",
    },
  });
  await logEvent({ customerId, action: "admin_profile_edit" });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
}

/** Unlock a customer account — reset login attempts and clear lockout. */
export async function unlockCustomerAccount(customerId: string): Promise<void> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { internalNote: true },
  });
  if (!customer) throw new Error("Zákaznice nenalezena");

  await db.customer.update({
    where: { id: customerId },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
      internalNote: appendAudit(customer.internalNote, "Admin: účet odemknut"),
    },
  });
  await logEvent({ customerId, action: "admin_unlock" });

  revalidatePath(`/admin/customers/${customerId}`);
}

/** Disable an account — prevents login. */
export async function disableCustomerAccount(
  customerId: string,
  reason?: string,
): Promise<void> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { internalNote: true },
  });
  if (!customer) throw new Error("Zákaznice nenalezena");

  const reasonText = reason?.trim().slice(0, 200);
  const auditLine = reasonText
    ? `Admin: účet pozastaven — ${reasonText}`
    : "Admin: účet pozastaven";

  await db.customer.update({
    where: { id: customerId },
    data: {
      disabled: true,
      internalNote: appendAudit(customer.internalNote, auditLine),
    },
  });
  await logEvent({
    customerId,
    action: "admin_disable",
    metadata: reasonText ? { reason: reasonText } : {},
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
}

/** Re-enable a disabled account. */
export async function enableCustomerAccount(customerId: string): Promise<void> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { internalNote: true },
  });
  if (!customer) throw new Error("Zákaznice nenalezena");

  await db.customer.update({
    where: { id: customerId },
    data: {
      disabled: false,
      internalNote: appendAudit(customer.internalNote, "Admin: účet aktivován"),
    },
  });
  await logEvent({ customerId, action: "admin_enable" });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
}

/** GDPR anonymize — same as customer-initiated delete but initiated by admin. Keeps orders intact. */
export async function anonymizeCustomerAccount(
  customerId: string,
  reason?: string,
): Promise<void> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { id: true, deletedAt: true, internalNote: true },
  });
  if (!customer) throw new Error("Zákaznice nenalezena");
  if (customer.deletedAt) throw new Error("Účet už je smazaný.");

  const reasonText = reason?.trim().slice(0, 200);
  const auditLine = reasonText
    ? `Admin: GDPR anonymizace — ${reasonText}`
    : "Admin: GDPR anonymizace";

  const anonEmail = `deleted-${customer.id}@anonymized.local`;

  // Log BEFORE mutation so metadata can still reference identifiers if needed.
  await logEvent({
    customerId,
    action: "admin_anonymize",
    metadata: reasonText ? { reason: reasonText } : {},
  });

  await db.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: {
        email: anonEmail,
        password: null,
        firstName: "Anonymizováno",
        lastName: "Anonymizováno",
        phone: null,
        street: null,
        city: null,
        zip: null,
        notifyMarketing: false,
        deletedAt: new Date(),
        internalNote: appendAudit(customer.internalNote, auditLine),
      },
    });
    await tx.customerAddress.deleteMany({ where: { customerId } });
    await tx.customerWishlist.deleteMany({ where: { customerId } });
  });

  revalidatePath(`/admin/customers/${customerId}`);
  revalidatePath("/admin/customers");
}

/** Force password reset — clears password and marks for audit. Customer must use "forgot password" flow. */
export async function forceCustomerPasswordReset(
  customerId: string,
): Promise<void> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { internalNote: true },
  });
  if (!customer) throw new Error("Zákaznice nenalezena");

  await db.customer.update({
    where: { id: customerId },
    data: {
      password: null,
      loginAttempts: 0,
      lockedUntil: null,
      internalNote: appendAudit(
        customer.internalNote,
        'Admin: vynucen reset hesla — zákaznice musí použít „Zapomenuté heslo"',
      ),
    },
  });
  await logEvent({ customerId, action: "admin_force_reset" });

  revalidatePath(`/admin/customers/${customerId}`);
}
