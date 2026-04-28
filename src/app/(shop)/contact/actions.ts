"use server";

import { z } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const MINUTE = 60 * 1000;

const contactSchema = z.object({
  name: z.string().min(1, "Vyplňte jméno").max(100),
  email: z.string().email("Zadejte platný e-mail").max(200),
  subject: z.enum(["order", "product", "shipping", "return", "other"]),
  message: z.string().min(10, "Zpráva musí mít alespoň 10 znaků").max(5000),
});

const SUBJECT_LABELS: Record<string, string> = {
  order: "Dotaz k objednávce",
  product: "Dotaz k produktu",
  shipping: "Doprava",
  return: "Vrácení / reklamace",
  other: "Jiné",
};

export async function submitContactForm(
  _prev: { success: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  // Rate limit: 5 submissions per 10 minutes per IP
  const ip = await getClientIp();
  const rl = checkRateLimit(`contact:${ip}`, 5, 10 * MINUTE);
  if (!rl.success) {
    return { success: false, error: "Příliš mnoho zpráv. Zkuste to prosím za chvíli." };
  }

  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  };

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Neplatný formulář";
    return { success: false, error: firstError };
  }

  const { name, email, subject, message } = parsed.data;
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;

  try {
    const { getMailer } = await import("@/lib/email/resend-transport");
    const { FROM_SUPPORT } = await import("@/lib/email/addresses");
    const mailer = getMailer();
    if (!mailer) {
      return { success: false, error: "E-mailová služba není dostupná. Kontaktujte nás prosím přímo na podpora@jvsatnik.cz." };
    }

    const shopEmail = process.env.CONTACT_EMAIL ?? "podpora@jvsatnik.cz";

    await mailer.sendMail({
      from: FROM_SUPPORT,
      to: shopEmail,
      replyTo: email,
      subject: `Kontaktní formulář: ${subjectLabel}`,
      html: buildContactEmailHtml({ name, email, subject: subjectLabel, message }),
    });
  } catch (err) {
    logger.error("[contact] Failed to send email:", err);
    return { success: false, error: "Nepodařilo se odeslat zprávu. Zkuste to prosím později." };
  }

  return { success: true };
}

function buildContactEmailHtml(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
  <div style="border-bottom: 2px solid #e5e5e5; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="font-size: 20px; margin: 0;">Nová zpráva z kontaktního formuláře</h1>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <tr>
      <td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600; width: 120px; border: 1px solid #e5e5e5;">Jméno</td>
      <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${escapeHtml(data.name)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600; border: 1px solid #e5e5e5;">E-mail</td>
      <td style="padding: 8px 12px; border: 1px solid #e5e5e5;"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; background: #f5f5f5; font-weight: 600; border: 1px solid #e5e5e5;">Předmět</td>
      <td style="padding: 8px 12px; border: 1px solid #e5e5e5;">${escapeHtml(data.subject)}</td>
    </tr>
  </table>

  <div style="background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px;">
    <h2 style="font-size: 14px; margin: 0 0 8px; color: #666;">Zpráva:</h2>
    <p style="margin: 0; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(data.message)}</p>
  </div>

  <p style="margin-top: 24px; font-size: 12px; color: #999;">
    Odpovědět můžete přímo na tento e-mail — odpověď půjde na ${escapeHtml(data.email)}.
  </p>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
