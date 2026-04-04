"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";

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
  const parsed = lookupSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, message: first?.message ?? "Neplatné údaje." };
  }

  const { orderNumber, email } = parsed.data;

  const order = await prisma.order.findUnique({
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
