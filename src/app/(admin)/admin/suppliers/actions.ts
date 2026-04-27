"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimitAdmin } from "@/lib/rate-limit";

const supplierSchema = z.object({
  name: z
    .string()
    .min(1, "Název je povinný")
    .max(200, "Název je příliš dlouhý")
    .transform((s) => s.trim()),
  url: z
    .string()
    .max(2048, "URL je příliš dlouhé")
    .url("Neplatné URL")
    .nullable()
    .or(z.literal("").transform(() => null)),
  contactEmail: z
    .string()
    .max(320, "E-mail je příliš dlouhý")
    .email("Neplatný e-mail")
    .nullable()
    .or(z.literal("").transform(() => null)),
  contactPhone: z
    .string()
    .max(50, "Telefon je příliš dlouhý")
    .nullable()
    .or(z.literal("").transform(() => null)),
  notes: z
    .string()
    .max(8000, "Poznámky jsou příliš dlouhé")
    .nullable()
    .or(z.literal("").transform(() => null)),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
}

function parseFromForm(formData: FormData) {
  return supplierSchema.parse({
    name: (formData.get("name") as string) ?? "",
    url: (formData.get("url") as string) || null,
    contactEmail: (formData.get("contactEmail") as string) || null,
    contactPhone: (formData.get("contactPhone") as string) || null,
    notes: (formData.get("notes") as string) || null,
  });
}

function invalidate() {
  revalidateTag("admin-suppliers", "max");
  revalidatePath("/admin/suppliers");
}

export async function createSupplier(formData: FormData) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const data = parseFromForm(formData);
  const db = await getDb();

  const exists = await db.supplier.findUnique({ where: { name: data.name } });
  if (exists) throw new Error("Dodavatel s tímto názvem již existuje");

  await db.supplier.create({
    data: {
      name: data.name,
      url: data.url,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      notes: data.notes,
    },
  });

  invalidate();
}

export async function updateSupplier(id: string, formData: FormData) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const data = parseFromForm(formData);
  const db = await getDb();

  const nameClash = await db.supplier.findFirst({
    where: { name: data.name, NOT: { id } },
    select: { id: true },
  });
  if (nameClash) throw new Error("Dodavatel s tímto názvem již existuje");

  await db.supplier.update({
    where: { id },
    data: {
      name: data.name,
      url: data.url,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      notes: data.notes,
    },
  });

  invalidate();
}

export async function toggleSupplierActive(id: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  const current = await db.supplier.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!current) throw new Error("Dodavatel nenalezen");

  await db.supplier.update({
    where: { id },
    data: { active: !current.active },
  });

  invalidate();
}

export async function deleteSupplier(id: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();

  const bundleCount = await db.supplierBundle.count({ where: { supplierId: id } });
  if (bundleCount > 0) {
    throw new Error(
      `Nelze smazat — dodavatel má ${bundleCount} ${bundleCount === 1 ? "balík" : bundleCount >= 2 && bundleCount <= 4 ? "balíky" : "balíků"}. Nejdříve smažte balíky.`,
    );
  }

  await db.supplier.delete({ where: { id } });

  invalidate();
}
