"use server";

import { getDb } from "@/lib/db";
import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const lookupSchema = z.object({
  orderNumber: z.string().trim().min(1, "Zadejte číslo objednávky"),
  email: z.string().trim().email("Zadejte platný e-mail").max(254),
});

export type LookupResult = {
  success: boolean;
  message: string;
  redirectUrl?: string;
};

export async function lookupOrder(
  _prev: LookupResult | null,
  formData: FormData,
): Promise<LookupResult> {
  // Rate limit: 10 lookups per 5 minutes per IP (prevents email enumeration)
  const ip = await getClientIp();
  const rl = checkRateLimit(`order-lookup:${ip}`, 10, 5 * 60 * 1000);
  if (!rl.success) {
    return {
      success: false,
      message: "Příliš mnoho pokusů. Zkuste to prosím za chvíli.",
    };
  }

  const parsed = lookupSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, message: first?.message ?? "Neplatné údaje." };
  }

  const { orderNumber, email } = parsed.data;

  const db = await getDb();
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { customer: { select: { email: true } } },
  });

  // Generic error to prevent order enumeration
  if (!order || order.customer.email.toLowerCase() !== email.toLowerCase() || !order.accessToken) {
    return {
      success: false,
      message: "Objednávka nebyla nalezena. Zkontrolujte číslo objednávky a e-mail.",
    };
  }

  return {
    success: true,
    message: "Objednávka nalezena",
    redirectUrl: `/order/${order.orderNumber}?token=${order.accessToken}`,
  };
}
