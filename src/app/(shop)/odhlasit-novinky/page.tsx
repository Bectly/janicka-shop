export const revalidate = 300;

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Odhlásit se z odběru novinek | Janička Shop",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ email?: string }>;
}

/**
 * Newsletter unsubscribe page.
 * Linked from new-arrival email footer: /odhlasit-novinky?email=...
 *
 * Performs the unsubscribe at render time — GET-triggered mutation is
 * intentional and expected for email unsubscribe links. The operation
 * is idempotent (setting active=false repeatedly is safe).
 */
export default async function UnsubscribeNewsletterPage({ searchParams }: Props) {
  const { email } = await searchParams;

  // Basic validation — no email → redirect home
  if (!email || typeof email !== "string" || !email.includes("@") || email.length > 255) {
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
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg
                className="h-8 w-8 text-emerald-600"
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
        </>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <svg
                className="h-8 w-8 text-destructive"
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
            <a href="/contact" className="text-foreground underline underline-offset-4">
              kontaktujte
            </a>
            .
          </p>
        </>
      )}
      <a
        href="/"
        className="mt-8 inline-block rounded-lg bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80"
      >
        Zpět do obchodu
      </a>
    </div>
  );
}
