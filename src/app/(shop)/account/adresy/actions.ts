"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const CZ_ZIP_RE = /^\d{3} ?\d{2}$/;

const addressSchema = z.object({
  label: z.string().trim().min(1).max(40),
  firstName: z.string().trim().min(1, "Jméno je povinné").max(80),
  lastName: z.string().trim().min(1, "Příjmení je povinné").max(80),
  street: z.string().trim().min(1, "Ulice je povinná").max(200),
  city: z.string().trim().min(1, "Město je povinné").max(120),
  zip: z
    .string()
    .trim()
    .refine((v) => CZ_ZIP_RE.test(v), "PSČ musí být ve formátu 12345 nebo 123 45"),
  country: z.string().trim().min(2).max(2).default("CZ"),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : undefined)),
  isDefault: z.boolean().optional(),
});

export type AddressFormState = {
  error: string | null;
  success: boolean;
};

const INITIAL: AddressFormState = { error: null, success: false };

function parseForm(formData: FormData) {
  return addressSchema.safeParse({
    label: formData.get("label") || "Adresa",
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    street: formData.get("street"),
    city: formData.get("city"),
    zip: formData.get("zip"),
    country: formData.get("country") || "CZ",
    phone: formData.get("phone") || undefined,
    isDefault: formData.get("isDefault") === "on",
  });
}

export async function createAddress(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { error: "Nejste přihlášena.", success: false };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatná data", success: false };
  }

  const db = await getDb();
  const customerId = session.user.id;

  // If first address OR marked default → unset others
  const existingCount = await db.customerAddress.count({ where: { customerId } });
  const makeDefault = parsed.data.isDefault || existingCount === 0;

  await db.$transaction(async (tx) => {
    if (makeDefault) {
      await tx.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.customerAddress.create({
      data: {
        customerId,
        label: parsed.data.label,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        street: parsed.data.street,
        city: parsed.data.city,
        zip: parsed.data.zip.replace(/\s/g, ""),
        country: parsed.data.country.toUpperCase(),
        phone: parsed.data.phone ?? null,
        isDefault: makeDefault,
      },
    });
  });

  revalidatePath("/account/adresy");
  return { ...INITIAL, success: true };
}

export async function updateAddress(
  id: string,
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { error: "Nejste přihlášena.", success: false };
  }

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatná data", success: false };
  }

  const db = await getDb();
  const customerId = session.user.id;
  const existing = await db.customerAddress.findFirst({ where: { id, customerId } });
  if (!existing) return { error: "Adresa nenalezena.", success: false };

  await db.$transaction(async (tx) => {
    if (parsed.data.isDefault && !existing.isDefault) {
      await tx.customerAddress.updateMany({
        where: { customerId, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.customerAddress.update({
      where: { id },
      data: {
        label: parsed.data.label,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        street: parsed.data.street,
        city: parsed.data.city,
        zip: parsed.data.zip.replace(/\s/g, ""),
        country: parsed.data.country.toUpperCase(),
        phone: parsed.data.phone ?? null,
        isDefault: parsed.data.isDefault ?? existing.isDefault,
      },
    });
  });

  revalidatePath("/account/adresy");
  return { ...INITIAL, success: true };
}

export async function deleteAddress(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { ok: false, error: "Nejste přihlášena." };
  }

  const db = await getDb();
  const customerId = session.user.id;
  const existing = await db.customerAddress.findFirst({ where: { id, customerId } });
  if (!existing) return { ok: false, error: "Adresa nenalezena." };

  await db.customerAddress.delete({ where: { id } });

  // If deleted address was default, promote any other to default
  if (existing.isDefault) {
    const next = await db.customerAddress.findFirst({
      where: { customerId },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await db.customerAddress.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  revalidatePath("/account/adresy");
  return { ok: true };
}

export async function setDefaultAddress(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { ok: false, error: "Nejste přihlášena." };
  }

  const db = await getDb();
  const customerId = session.user.id;
  const existing = await db.customerAddress.findFirst({ where: { id, customerId } });
  if (!existing) return { ok: false, error: "Adresa nenalezena." };

  await db.$transaction(async (tx) => {
    await tx.customerAddress.updateMany({
      where: { customerId, isDefault: true },
      data: { isDefault: false },
    });
    await tx.customerAddress.update({ where: { id }, data: { isDefault: true } });
  });

  revalidatePath("/account/adresy");
  return { ok: true };
}
