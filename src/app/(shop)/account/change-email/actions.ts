"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/audit-log";
import { sendEmailChangeVerifyEmail } from "@/lib/email";

const schema = z.object({
  newEmail: z.string().trim().toLowerCase().email("Zadej platný email").max(200),
  currentPassword: z.string().min(1, "Potvrď svým aktuálním heslem"),
});

export type ChangeEmailState = {
  error: string | null;
  success: boolean;
  pending?: string;
};

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function requestEmailChange(
  _prev: ChangeEmailState,
  formData: FormData,
): Promise<ChangeEmailState> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { error: "Nejste přihlášena.", success: false };
  }

  const parsed = schema.safeParse({
    newEmail: formData.get("newEmail"),
    currentPassword: formData.get("currentPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatná data", success: false };
  }

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      password: true,
      lastEmailChangeAt: true,
    },
  });
  if (!customer) return { error: "Účet nenalezen.", success: false };

  if (parsed.data.newEmail === customer.email.toLowerCase()) {
    return { error: "Nový email je stejný jako aktuální.", success: false };
  }

  if (
    customer.lastEmailChangeAt &&
    Date.now() - customer.lastEmailChangeAt.getTime() < RATE_LIMIT_MS
  ) {
    return {
      error: "Změnu emailu můžeš požádat jednou za 24 hodin.",
      success: false,
    };
  }

  if (!customer.password) {
    return { error: "Účet nemá nastavené heslo.", success: false };
  }
  const { compare } = await import("bcryptjs");
  const ok = await compare(parsed.data.currentPassword, customer.password);
  if (!ok) {
    return { error: "Aktuální heslo je nesprávné.", success: false };
  }

  const taken = await db.customer.findUnique({
    where: { email: parsed.data.newEmail },
    select: { id: true },
  });
  if (taken) {
    return { error: "Tenhle email je už použitý.", success: false };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.customer.update({
    where: { id: customer.id },
    data: {
      pendingEmail: parsed.data.newEmail,
      pendingEmailToken: token,
      pendingEmailExpiresAt: expiresAt,
    },
  });

  await logEvent({
    customerId: customer.id,
    action: "email_change_request",
    metadata: { newEmail: parsed.data.newEmail },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const verifyUrl = `${baseUrl}/verify-email-change?token=${encodeURIComponent(token)}`;
  await sendEmailChangeVerifyEmail({
    newEmail: parsed.data.newEmail,
    firstName: customer.firstName,
    verifyUrl,
  });

  return { error: null, success: true, pending: parsed.data.newEmail };
}
