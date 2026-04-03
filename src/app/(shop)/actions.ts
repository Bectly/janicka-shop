"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";

const newsletterSchema = z.object({
  email: z.string().email("Zadejte platný e-mail"),
});

export async function subscribeNewsletter(
  _prev: { success: boolean; message: string } | null,
  formData: FormData,
): Promise<{ success: boolean; message: string }> {
  const parsed = newsletterSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { success: false, message: "Zadejte platný e-mail." };
  }

  const { email } = parsed.data;

  try {
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existing) {
      if (existing.active) {
        return { success: true, message: "Tento e-mail je již přihlášen k odběru." };
      }
      // Reactivate
      await prisma.newsletterSubscriber.update({
        where: { email },
        data: { active: true },
      });
      return { success: true, message: "Vítejte zpět! Odběr byl znovu aktivován." };
    }

    await prisma.newsletterSubscriber.create({ data: { email } });
    return {
      success: true,
      message: "Děkujeme za přihlášení! Brzy se ozveme.",
    };
  } catch {
    return {
      success: false,
      message: "Něco se pokazilo. Zkuste to prosím znovu.",
    };
  }
}
