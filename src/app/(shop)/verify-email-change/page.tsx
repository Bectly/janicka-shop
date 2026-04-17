import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/audit-log";
import { sendEmailChangeNoticeEmail } from "@/lib/email";

export const metadata: Metadata = {
  title: "Potvrzení změny emailu — Janička",
};

async function verifyToken(token: string): Promise<
  | { status: "ok"; email: string }
  | { status: "expired" }
  | { status: "invalid" }
> {
  if (!token || token.length < 16 || token.length > 128) {
    return { status: "invalid" };
  }
  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { pendingEmailToken: token },
    select: {
      id: true,
      email: true,
      firstName: true,
      pendingEmail: true,
      pendingEmailExpiresAt: true,
    },
  });
  if (!customer || !customer.pendingEmail) return { status: "invalid" };
  if (
    !customer.pendingEmailExpiresAt ||
    customer.pendingEmailExpiresAt.getTime() < Date.now()
  ) {
    await db.customer.update({
      where: { id: customer.id },
      data: {
        pendingEmail: null,
        pendingEmailToken: null,
        pendingEmailExpiresAt: null,
      },
    });
    return { status: "expired" };
  }

  const newEmail = customer.pendingEmail;

  // Guard against a race: the new email could have been claimed between
  // request and verify.
  const taken = await db.customer.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (taken && taken.id !== customer.id) {
    await db.customer.update({
      where: { id: customer.id },
      data: {
        pendingEmail: null,
        pendingEmailToken: null,
        pendingEmailExpiresAt: null,
      },
    });
    return { status: "invalid" };
  }

  const oldEmail = customer.email;
  const now = new Date();
  await db.customer.update({
    where: { id: customer.id },
    data: {
      email: newEmail,
      pendingEmail: null,
      pendingEmailToken: null,
      pendingEmailExpiresAt: null,
      emailVerified: now,
      lastEmailChangeAt: now,
    },
  });

  // Mirror into NewsletterSubscriber if one exists for the old email.
  try {
    await db.newsletterSubscriber.updateMany({
      where: { email: oldEmail.toLowerCase() },
      data: { email: newEmail },
    });
  } catch {
    // Collision (subscriber row already exists on new email) — ignore.
  }

  await logEvent({
    customerId: customer.id,
    action: "email_change_confirmed",
    metadata: { from: oldEmail, to: newEmail },
  });

  // Notify old address as security signal.
  await sendEmailChangeNoticeEmail({
    oldEmail,
    newEmail,
    firstName: customer.firstName,
  });

  return { status: "ok", email: newEmail };
}

export default async function VerifyEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await connection();
  const { token } = await searchParams;
  const result = await verifyToken(token ?? "");

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        {result.status === "ok" && (
          <>
            <h1 className="font-heading text-2xl font-semibold">Email úspěšně změněn</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Od teď se přihlašuj pomocí <strong>{result.email}</strong>. Pro jistotu jsme
              poslali upozornění i na tvou původní adresu.
            </p>
            <div className="mt-6 flex gap-2">
              <Link href="/account" className={buttonVariants()}>Zpět na účet</Link>
              <Link href="/login" className={buttonVariants({ variant: "outline" })}>Přihlásit se</Link>
            </div>
          </>
        )}
        {result.status === "expired" && (
          <>
            <h1 className="font-heading text-2xl font-semibold">Odkaz vypršel</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Ověřovací odkaz je platný 1 hodinu. Vrať se do účtu a pošli si ho znovu.
            </p>
            <Link href="/account/change-email" className={cn(buttonVariants(), "mt-6")}>Poslat odkaz znovu</Link>
          </>
        )}
        {result.status === "invalid" && (
          <>
            <h1 className="font-heading text-2xl font-semibold">Neplatný odkaz</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Odkaz nejde přiřadit k žádnému účtu. Mohl už být použitý — zkus se přihlásit
              svým novým emailem, nebo pošli žádost znovu.
            </p>
            <div className="mt-6 flex gap-2">
              <Link href="/account/change-email" className={buttonVariants()}>Zkusit znovu</Link>
              <Link href="/login" className={buttonVariants({ variant: "outline" })}>Přihlásit se</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
