import nodemailer, { type Transporter } from "nodemailer";
import { logger } from "@/lib/logger";

let cached: Transporter | null | undefined;

/**
 * Lazily build a singleton nodemailer transport from SMTP_* env vars.
 * Returns null when credentials are missing so callers can skip gracefully
 * (matches the prior Resend behavior — email failures never block flows).
 */
export function getMailer(): Transporter | null {
  if (cached !== undefined) return cached;

  const host = process.env.SMTP_HOST?.trim();
  const port = Number((process.env.SMTP_PORT ?? "587").trim());
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();

  if (!host || !user || !pass) {
    logger.warn(
      "[smtp] SMTP_HOST/SMTP_USER/SMTP_PASSWORD not set — emails disabled",
    );
    cached = null;
    return null;
  }

  cached = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cached;
}
