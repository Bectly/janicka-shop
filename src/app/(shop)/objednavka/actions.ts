"use server";

import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const lookupSchema = z.object({
  orderNumber: z
    .string()
    .min(1, "Zadejte číslo objednávky")
    .max(30, "Neplatné číslo objednávky")
    .transform((v) => v.trim().toUpperCase()),
  email: z
    .string()
    .email("Zadejte platný email")
    .max(254)
    .transform((v) => v.trim().toLowerCase()),
});

export type LookupState = {
  error: string | null;
};

export async function lookupOrder(
  _prev: LookupState,
  formData: FormData
): Promise<LookupState> {
  // Rate limit: 10 lookups per minute per IP
  const ip = await getClientIp();
  const rl = checkRateLimit(`order-lookup:${ip}`, 10, 60_000);
  if (!rl.success) {
    return { error: "Příliš mnoho pokusů. Zkuste to prosím za chvíli." };
  }

  const raw = {
    orderNumber: formData.get("orderNumber") as string,
    email: formData.get("email") as string,
  };

  const result = lookupSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return { error: first?.message ?? "Neplatné údaje" };
  }

  const { orderNumber, email } = result.data;
  const db = await getDb();

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { customer: { select: { email: true } } },
  });

  // Constant-time-ish response — don't reveal whether order exists
  if (!order || order.customer.email.toLowerCase() !== email) {
    return {
      error: "Objednávka nenalezena. Zkontrolujte číslo objednávky a email.",
    };
  }

  redirect(`/order/${order.orderNumber}?token=${order.accessToken}`);
}
