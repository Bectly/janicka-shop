"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/audit-log";

export async function updateEmailPreferences(
  _prev: { error: string | null; success: boolean },
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { error: "Nejste přihlášena.", success: false };
  }

  const notifyMarketing = formData.get("notifyMarketing") === "on";

  const db = await getDb();
  await db.customer.update({
    where: { id: session.user.id },
    data: { notifyMarketing },
  });

  // Mirror to NewsletterSubscriber if row exists for this email
  const customer = await db.customer.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  });
  if (customer) {
    await db.newsletterSubscriber.updateMany({
      where: { email: customer.email.toLowerCase() },
      data: { active: notifyMarketing },
    });
  }

  revalidatePath("/account/nastaveni");
  return { error: null, success: true };
}

export async function deleteAccount(
  _prev: { error: string | null; success: boolean },
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return { error: "Nejste přihlášena.", success: false };
  }

  const confirmEmail = String(formData.get("confirmEmail") ?? "").trim().toLowerCase();
  const db = await getDb();

  const customer = await db.customer.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true },
  });
  if (!customer) {
    return { error: "Účet nenalezen.", success: false };
  }

  if (confirmEmail !== customer.email.toLowerCase()) {
    return { error: "Pro potvrzení zadej svůj přihlašovací email přesně.", success: false };
  }

  // Soft-delete + anonymize. Keep orders (10-year accounting retention per CZ law).
  const now = new Date();
  const anonymizedEmail = `deleted-${customer.id}@janicka.local`;

  // Log the delete intent BEFORE anonymizing — otherwise userAgent/ip context
  // is fine but the customer row is already mutated by the time we'd log.
  await logEvent({
    customerId: customer.id,
    action: "account_delete",
    metadata: { emailOriginal: customer.email },
  });

  await db.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id: customer.id },
      data: {
        deletedAt: now,
        email: anonymizedEmail,
        password: null,
        firstName: "Smazaný",
        lastName: "účet",
        phone: null,
        street: null,
        city: null,
        zip: null,
        notifyMarketing: false,
        internalNote: null,
        tags: "[]",
      },
    });
    // Drop addresses and DB wishlist (cascade on relation would handle, but be explicit)
    await tx.customerAddress.deleteMany({ where: { customerId: customer.id } });
    await tx.customerWishlist.deleteMany({ where: { customerId: customer.id } });

    // Anonymize + deactivate newsletter subscriber tied to the original email.
    await tx.newsletterSubscriber.updateMany({
      where: { email: customer.email.toLowerCase() },
      data: { active: false, email: anonymizedEmail, firstName: null },
    });
  });

  // Sign out (cookies invalidated)
  await signOut({ redirect: false });

  return { error: null, success: true };
}
