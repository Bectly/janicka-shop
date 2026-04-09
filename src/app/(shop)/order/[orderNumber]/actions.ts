"use server";

import { getDb } from "@/lib/db";
import { hash } from "bcryptjs";
import { z } from "zod";

const createAccountSchema = z.object({
  orderNumber: z.string().min(1),
  accessToken: z.string().min(1),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků"),
});

export async function createAccountFromOrder(
  orderNumber: string,
  accessToken: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const parsed = createAccountSchema.safeParse({ orderNumber, accessToken, password });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Neplatný vstup" };
  }

  const db = await getDb();

  // Verify order exists and token matches
  const order = await db.order.findUnique({
    where: { orderNumber },
    select: { accessToken: true, customerId: true },
  });

  if (!order || order.accessToken !== accessToken) {
    return { success: false, error: "Objednávka nenalezena" };
  }

  // Check customer doesn't already have a password
  const customer = await db.customer.findUnique({
    where: { id: order.customerId },
    select: { id: true, password: true },
  });

  if (!customer) {
    return { success: false, error: "Zákazník nenalezen" };
  }

  if (customer.password) {
    return { success: false, error: "Účet již existuje" };
  }

  // Hash password and save
  const hashedPassword = await hash(password, 12);
  await db.customer.update({
    where: { id: customer.id },
    data: { password: hashedPassword },
  });

  return { success: true };
}
