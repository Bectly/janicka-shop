"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

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

  revalidatePath("/account/profile");
  revalidatePath("/account");
  return { error: null, success: true };
}
