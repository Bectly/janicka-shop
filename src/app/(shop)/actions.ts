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
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, active: true },
      update: { active: true },
    });
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
