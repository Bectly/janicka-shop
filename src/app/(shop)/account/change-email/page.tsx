import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ChangeEmailForm } from "./change-email-form";

export const metadata: Metadata = {
  title: "Změna emailu — Janička",
};

export default async function ChangeEmailPage() {
  await connection();
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account/change-email");
  }

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: session.user.id },
    select: { email: true, pendingEmail: true, pendingEmailExpiresAt: true },
  });
  if (!customer) redirect("/login");

  // eslint-disable-next-line react-hooks/purity -- request-time read in RSC, not cached
  const now = Date.now();
  const hasPending =
    !!customer.pendingEmail &&
    !!customer.pendingEmailExpiresAt &&
    customer.pendingEmailExpiresAt.getTime() > now;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Změna emailu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pošleme ti ověřovací odkaz na novou adresu. Email se přepne až po potvrzení.
        </p>
      </div>

      {hasPending && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p>
            Čekáme na potvrzení emailu <strong>{customer.pendingEmail}</strong>. Pokud jsi
            odkaz neobdržela, odešli žádost znovu níže — starý token přepíšeme.
          </p>
        </div>
      )}

      <ChangeEmailForm currentEmail={customer.email} />
    </div>
  );
}
