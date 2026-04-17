"use server";

import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { rateLimitAdmin, checkRateLimitOnly, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";
import {
  extractMeasurements,
  hasAnyMeasurement,
  parseExistingMeasurements,
  type MeasurementField,
} from "@/lib/measurements-extractor";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

const settingsSchema = z.object({
  shopName: z.string().trim().min(1, "Název obchodu je povinný").max(100),
  description: z.string().trim().max(500).default(""),
  contactEmail: z.string().trim().email("Neplatný e-mail").or(z.literal("")).default(""),
  contactPhone: z.string().trim().max(20).default(""),
  street: z.string().trim().max(200).default(""),
  city: z.string().trim().max(100).default(""),
  zip: z.string().trim().max(10).default(""),
  ico: z.string().trim().max(20).default(""),
  dic: z.string().trim().max(20).default(""),
  instagram: z.string().trim().max(200).default(""),
  facebook: z.string().trim().max(200).default(""),
});

export type SettingsResult = {
  success: boolean;
  message: string;
};

export async function getShopSettings() {
  await requireAdmin();

  const db = await getDb();
  const settings = await db.shopSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    return db.shopSettings.create({
      data: { id: "singleton" },
    });
  }

  return settings;
}

export async function updateShopSettings(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) {
    return { success: false, message: "Příliš mnoho požadavků. Zkuste to za chvíli." };
  }

  const raw = {
    shopName: formData.get("shopName") ?? "",
    description: formData.get("description") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    street: formData.get("street") ?? "",
    city: formData.get("city") ?? "",
    zip: formData.get("zip") ?? "",
    ico: formData.get("ico") ?? "",
    dic: formData.get("dic") ?? "",
    instagram: formData.get("instagram") ?? "",
    facebook: formData.get("facebook") ?? "",
  };

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, message: first?.message ?? "Neplatné údaje" };
  }

  const db = await getDb();
  await db.shopSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/");

  return { success: true, message: "Nastavení uloženo" };
}

// --- Password change ---

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Zadejte aktuální heslo"),
    newPassword: z.string().min(8, "Nové heslo musí mít alespoň 8 znaků"),
    confirmPassword: z.string().min(1, "Potvrďte nové heslo"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Hesla se neshodují",
    path: ["confirmPassword"],
  });

export type PasswordResult = {
  success: boolean;
  message: string;
};

export async function updateAdminPassword(
  _prev: PasswordResult | null,
  formData: FormData,
): Promise<PasswordResult> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, message: "Nejste přihlášeni" };
  }

  // Rate limit: 5 failed password change attempts per 15 minutes
  const ip = await getClientIp();
  const rl = checkRateLimitOnly(`password-change:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.success) {
    return { success: false, message: "Příliš mnoho pokusů. Zkuste to za 15 minut." };
  }

  const raw = {
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  };

  const parsed = passwordSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, message: first?.message ?? "Neplatné údaje" };
  }

  const db = await getDb();
  const admin = await db.admin.findUnique({
    where: { email: session.user.email },
  });

  if (!admin) {
    return { success: false, message: "Účet nenalezen" };
  }

  const { compare, hash } = await import("bcryptjs");

  const isCurrentValid = await compare(parsed.data.currentPassword, admin.password);
  if (!isCurrentValid) {
    recordRateLimitHit(`password-change:${ip}`);
    return { success: false, message: "Aktuální heslo je nesprávné" };
  }

  const hashedPassword = await hash(parsed.data.newPassword, 12);

  await db.admin.update({
    where: { id: admin.id },
    data: { password: hashedPassword },
  });

  return { success: true, message: "Heslo bylo úspěšně změněno" };
}

// --- Measurements backfill (extract chest/waist/hips/length from
// originalDescription into Product.measurements). Mirrors
// scripts/extract-measurements-from-descriptions.ts but runs against the live
// Prisma client (Turso in production), so Janička can reseed measurements
// without terminal access. ---

export type MeasurementsBackfillResult = {
  success: boolean;
  message: string;
  totalScanned: number;
  updated: number;
  skipped: number;
  byField: Record<MeasurementField, number>;
};

export async function backfillMeasurements(): Promise<MeasurementsBackfillResult> {
  await requireAdmin();

  // Tighter rate limit than admin default — this is a write-heavy maintenance
  // op, not an everyday admin click. 1 per 60s per IP is plenty.
  const ip = await getClientIp();
  const rl = checkRateLimitOnly(`backfill-measurements:${ip}`, 1, 60 * 1000);
  if (!rl.success) {
    return {
      success: false,
      message: "Příliš mnoho pokusů. Počkejte minutu a zkuste znovu.",
      totalScanned: 0,
      updated: 0,
      skipped: 0,
      byField: { chest: 0, waist: 0, hips: 0, length: 0 },
    };
  }
  recordRateLimitHit(`backfill-measurements:${ip}`);

  const db = await getDb();
  const products = await db.product.findMany({
    select: {
      id: true,
      measurements: true,
      originalDescription: true,
    },
  });

  let totalScanned = 0;
  let updated = 0;
  let skipped = 0;
  const byField: Record<MeasurementField, number> = {
    chest: 0,
    waist: 0,
    hips: 0,
    length: 0,
  };

  for (const p of products) {
    if (!p.originalDescription || !p.originalDescription.trim()) {
      skipped++;
      continue;
    }
    const existing = parseExistingMeasurements(p.measurements);
    if (hasAnyMeasurement(existing)) {
      skipped++;
      continue;
    }
    totalScanned++;

    const extracted = extractMeasurements(p.originalDescription);
    if (!hasAnyMeasurement(extracted)) continue;

    for (const k of Object.keys(extracted) as MeasurementField[]) {
      if (extracted[k] !== undefined) byField[k]++;
    }

    await db.product.update({
      where: { id: p.id },
      data: { measurements: JSON.stringify(extracted) },
    });
    updated++;
  }

  // Invalidate product caches so PDP shows the new Rozměry block immediately.
  try {
    revalidateTag("products", "max");
  } catch {
    // revalidateTag may not be configured — non-fatal.
  }
  revalidatePath("/admin/settings");

  return {
    success: true,
    message: `Hotovo. Aktualizováno ${updated} produktů (přeskočeno ${skipped}).`,
    totalScanned,
    updated,
    skipped,
    byField,
  };
}
