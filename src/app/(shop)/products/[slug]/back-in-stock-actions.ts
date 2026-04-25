"use server";

import { getDb } from "@/lib/db";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const backInStockSchema = z.object({
  email: z
    .string()
    .email("Zadejte platný email")
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
  categoryId: z.string().min(1).max(128),
  brand: z.string().max(200).optional(),
  size: z.string().max(50).optional(),
  condition: z.string().max(50).optional(),
  sourceProductId: z.string().max(128).optional(),
});

export type BackInStockState = {
  success: boolean;
  error: string | null;
};

export async function requestBackInStock(
  _prev: BackInStockState,
  formData: FormData,
): Promise<BackInStockState> {
  const ip = await getClientIp();
  const rl = checkRateLimit(`back-in-stock:${ip}`, 5, 60_000);
  if (!rl.success) {
    return { success: false, error: "Příliš mnoho požadavků. Zkuste to za chvíli." };
  }

  const raw = {
    email: formData.get("email") as string,
    categoryId: formData.get("categoryId") as string,
    brand: (formData.get("brand") as string) || undefined,
    size: (formData.get("size") as string) || undefined,
    condition: (formData.get("condition") as string) || undefined,
    sourceProductId: (formData.get("sourceProductId") as string) || undefined,
  };

  const result = backInStockSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return { success: false, error: first?.message ?? "Neplatné údaje" };
  }

  const { email, categoryId, brand, size, condition, sourceProductId } = result.data;
  const db = await getDb();

  // Deduplicate: same email + exact tuple not yet notified.
  const existing = await db.backInStockSubscription.findFirst({
    where: {
      email,
      categoryId,
      brand: brand ?? null,
      size: size ?? null,
      condition: condition ?? null,
      notifiedAt: null,
    },
  });

  if (!existing) {
    await db.backInStockSubscription.create({
      data: {
        email,
        categoryId,
        brand: brand ?? null,
        size: size ?? null,
        condition: condition ?? null,
        sourceProductId: sourceProductId ?? null,
      },
    });
  }

  return { success: true, error: null };
}
