"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
  const settings = await prisma.shopSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    return prisma.shopSettings.create({
      data: { id: "singleton" },
    });
  }

  return settings;
}

export async function updateShopSettings(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, message: "Neautorizováno" };
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

  await prisma.shopSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/");

  return { success: true, message: "Nastavení uloženo" };
}
