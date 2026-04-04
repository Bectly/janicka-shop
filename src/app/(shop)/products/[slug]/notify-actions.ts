"use server";

import { getDb } from "@/lib/db";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const notifySchema = z.object({
  email: z
    .string()
    .email("Zadejte platný email")
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
  categoryId: z.string().min(1).max(128),
  sizes: z.string().max(500), // JSON array
  brand: z.string().max(200).optional(),
});

export type NotifyState = {
  success: boolean;
  error: string | null;
};

export async function requestProductNotify(
  _prev: NotifyState,
  formData: FormData
): Promise<NotifyState> {
  // Rate limit: 5 notify requests per minute per IP
  const ip = await getClientIp();
  const rl = checkRateLimit(`product-notify:${ip}`, 5, 60_000);
  if (!rl.success) {
    return { success: false, error: "Příliš mnoho požadavků. Zkuste to za chvíli." };
  }

  const raw = {
    email: formData.get("email") as string,
    categoryId: formData.get("categoryId") as string,
    sizes: formData.get("sizes") as string,
    brand: (formData.get("brand") as string) || undefined,
  };

  const result = notifySchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return { success: false, error: first?.message ?? "Neplatné údaje" };
  }

  const { email, categoryId, sizes, brand } = result.data;
  const db = await getDb();

  // Deduplicate: don't create if same email + category + sizes combo already exists
  const existing = await db.productNotifyRequest.findFirst({
    where: { email, categoryId, notified: false },
  });

  if (existing) {
    // Update sizes/brand if changed
    await db.productNotifyRequest.update({
      where: { id: existing.id },
      data: { sizes, brand: brand ?? null },
    });
  } else {
    await db.productNotifyRequest.create({
      data: { email, categoryId, sizes, brand: brand ?? null },
    });
  }

  return { success: true, error: null };
}
