
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";
import { PreferenceCenter } from "./preference-center";
import { BellOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Odhlásit se z odběru novinek | Janička Shop",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ token?: string }>;
}

/**
 * Newsletter unsubscribe page.
 * Linked from new-arrival email footer: /odhlasit-novinky?token=...
 * Token is HMAC-signed to prevent enumeration (UNSUBSCRIBE_HMAC_SECRET).
 *
 * Performs the unsubscribe at render time — GET-triggered mutation is
 * intentional and expected for email unsubscribe links. The operation
 * is idempotent (setting active=false repeatedly is safe).
 */
export default async function UnsubscribeNewsletterPage({ searchParams }: Props) {
  const { token } = await searchParams;

  const email = token ? verifyUnsubscribeToken(token) : null;

  if (!email) {
    redirect("/");
  }

  let success = false;
  try {
    const db = await getDb();
    const subscriber = await db.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, active: true },
    });

    if (subscriber?.active) {
      await db.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { active: false },
      });
    }
    // If subscriber not found or already inactive — still show success (idempotent)
    success = true;
  } catch (error) {
    console.error("[Newsletter] Unsubscribe failed for", email, error);
    success = false;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      {success ? (
        <>
          {/* Editorial pill-badge header */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
              <BellOff className="size-3" />
              Odhlášení novinek
            </span>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sage-light/60 to-sage-light ring-1 ring-inset ring-sage-dark/10">
              <svg
                className="h-7 w-7 text-sage-dark"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Odhlášení proběhlo úspěšně
          </h1>
          <p className="mt-3 text-muted-foreground">
            Nebudeme tě už informovat o nových kouscích. Pokud se rozhodneš
            nakoupit, vždy tě rádi uvítáme.
          </p>
          <PreferenceCenter email={email} />
        </>
      ) : (
        <>
          {/* Editorial pill-badge header */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
              <BellOff className="size-3" />
              Odhlášení novinek
            </span>
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-destructive/[0.06] to-destructive/[0.12] ring-1 ring-inset ring-destructive/10">
              <svg
                className="h-7 w-7 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Něco se nepovedlo
          </h1>
          <p className="mt-3 text-muted-foreground">
            Odhlášení se nepodařilo. Zkuste to prosím znovu nebo nás{" "}
            <Link href="/contact" className="text-foreground underline underline-offset-4">
              kontaktujte
            </Link>
            .
          </p>
        </>
      )}
      <Link
        href="/"
        className="mt-8 inline-block rounded-lg bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
      >
        Zpět do obchodu
      </Link>
    </div>
  );
}
