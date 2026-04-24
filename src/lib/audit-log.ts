import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

export type AuditAction =
  | "login"
  | "login_failed"
  | "logout"
  | "password_change"
  | "password_reset"
  | "email_change_request"
  | "email_change_confirmed"
  | "profile_update"
  | "address_add"
  | "address_update"
  | "address_delete"
  | "wishlist_add"
  | "wishlist_remove"
  | "gdpr_export"
  | "account_delete"
  | "admin_unlock"
  | "admin_disable"
  | "admin_enable"
  | "admin_anonymize"
  | "admin_force_reset"
  | "admin_profile_edit";

const ACTION_LABELS: Record<AuditAction, string> = {
  login: "Přihlášení",
  login_failed: "Neúspěšné přihlášení",
  logout: "Odhlášení",
  password_change: "Změna hesla",
  password_reset: "Reset hesla",
  email_change_request: "Požadavek na změnu emailu",
  email_change_confirmed: "Email změněn",
  profile_update: "Úprava profilu",
  address_add: "Přidána adresa",
  address_update: "Úprava adresy",
  address_delete: "Smazána adresa",
  wishlist_add: "Přidáno do oblíbených",
  wishlist_remove: "Odebráno z oblíbených",
  gdpr_export: "Export dat (GDPR)",
  account_delete: "Smazání účtu",
  admin_unlock: "Admin odemkl účet",
  admin_disable: "Admin zablokoval účet",
  admin_enable: "Admin odblokoval účet",
  admin_anonymize: "Admin anonymizoval účet",
  admin_force_reset: "Admin vynutil reset hesla",
  admin_profile_edit: "Admin upravil profil",
};

export function labelForAction(action: string): string {
  return ACTION_LABELS[action as AuditAction] ?? action;
}

export interface LogEventInput {
  customerId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Append an audit-log row for a customer-level event. Failures are swallowed
 * (audit logging must never break the business flow it annotates).
 */
export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    let ip = input.ip ?? null;
    let ua = input.userAgent ?? null;
    if (ip === null || ua === null) {
      try {
        const h = await headers();
        ip =
          ip ??
          h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          h.get("x-real-ip") ??
          null;
        ua = ua ?? h.get("user-agent") ?? null;
      } catch {
        // Not in a request context — skip header lookup.
      }
    }

    const db = await getDb();
    await db.customerAuditLog.create({
      data: {
        customerId: input.customerId,
        action: input.action,
        ip,
        userAgent: ua,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    });
  } catch (err) {
    logger.error("[audit-log]", err);
  }
}

/** Convenience: look up customer by email then log (returns silently if missing). */
export async function logEventByEmail(
  email: string,
  action: AuditAction,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const db = await getDb();
    const customer = await db.customer.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    if (!customer) return;
    await logEvent({ customerId: customer.id, action, metadata });
  } catch (err) {
    logger.error("[audit-log]", err);
  }
}
