"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/audit-log";
import { invalidateCustomerScope } from "@/lib/customer-cache";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Jméno je povinné").max(80),
  lastName: z.string().trim().min(1, "Příjmení je povinné").max(80),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : undefined)),
  street: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v : undefined)),
  city: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : undefined)),
  zip: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type UpdateProfileState = {
  error: string | null;
  success: boolean;
};

export async function updateProfile(
  _prev: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { error: "Nejste přihlášena.", success: false };
  }

  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone") ?? undefined,
    street: formData.get("street") ?? undefined,
    city: formData.get("city") ?? undefined,
    zip: formData.get("zip") ?? undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Neplatná data",
      success: false,
    };
  }

  const db = await getDb();
  await db.customer.update({
    where: { id: session.user.id },
    data: parsed.data,
  });
  await logEvent({
    customerId: session.user.id,
    action: "profile_update",
    metadata: { fields: Object.keys(parsed.data) },
  });

  invalidateCustomerScope(session.user.id, "profile");
  invalidateCustomerScope(session.user.id, "dashboard");
  revalidatePath("/account/profile");
  revalidatePath("/account");
  return { error: null, success: true };
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Zadej aktuální heslo"),
  newPassword: z
    .string()
    .min(10, "Heslo musí mít alespoň 10 znaků")
    .max(200)
    .refine(
      (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v),
      "Heslo musí obsahovat malé i velké písmeno a číslici",
    ),
  confirmPassword: z.string().min(1),
});

export type ChangePasswordState = {
  error: string | null;
  success: boolean;
};

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { error: "Nejste přihlášena.", success: false };
  }

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatná data", success: false };
  }

  if (parsed.data.newPassword !== parsed.data.confirmPassword) {
    return { error: "Nová hesla se neshodují.", success: false };
  }

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });
  if (!customer?.password) {
    return { error: "Účet nemá nastavené heslo.", success: false };
  }

  const { compare, hash } = await import("bcryptjs");
  const ok = await compare(parsed.data.currentPassword, customer.password);
  if (!ok) {
    return { error: "Aktuální heslo je nesprávné.", success: false };
  }

  const newHash = await hash(parsed.data.newPassword, 12);
  await db.customer.update({
    where: { id: session.user.id },
    data: { password: newHash },
  });
  await logEvent({ customerId: session.user.id, action: "password_change" });

  revalidatePath("/account/profile");
  return { error: null, success: true };
}
