import type { Metadata } from "next";

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
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Napište nám
          </h2>
          <form className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-foreground"
              >
                Jméno
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Vaše jméno"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                E-mail
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="vas@email.cz"
              />
            </div>

            <div>
              <label
                htmlFor="subject"
                className="block text-sm font-medium text-foreground"
              >
                Předmět
              </label>
              <select
                id="subject"
                name="subject"
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="order">Dotaz k objednávce</option>
                <option value="product">Dotaz k produktu</option>
                <option value="shipping">Doprava</option>
                <option value="return">Vrácení / reklamace</option>
                <option value="other">Jiné</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-foreground"
              >
                Zpráva
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                required
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Jak vám můžeme pomoci?"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Odeslat zprávu
            </button>
            <p className="text-xs text-muted-foreground">
              Odesláním formuláře souhlasíte se zpracováním osobních údajů za
              účelem vyřízení vašeho dotazu.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
