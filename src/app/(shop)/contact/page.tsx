import type { Metadata } from "next";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Kontakt | Janička",
  description:
    "Kontaktujte nás — Janička second hand eshop. Rádi vám pomůžeme s objednávkou.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold text-foreground">
        Kontaktujte nás
      </h1>
      <p className="mt-2 text-muted-foreground">
        Máte dotaz k objednávce nebo potřebujete poradit s výběrem? Napište
        nám!
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {/* Contact info */}
        <div className="space-y-6">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              E-mail
            </h2>
            <p className="mt-1 text-muted-foreground">info@janicka.cz</p>
          </div>

          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Sociální sítě
            </h2>
            <p className="mt-1 text-muted-foreground">
              Sledujte nás na Instagramu pro novinky a inspiraci.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Doba odezvy
            </h2>
            <p className="mt-1 text-muted-foreground">
              Na e-maily odpovídáme obvykle do 24 hodin v pracovní dny.
            </p>
          </div>
        </div>

        {/* Contact form */}
        <ContactForm />
      </div>
    </div>
  );
}
