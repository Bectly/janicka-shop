import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Doprava a platba | Janička",
  description:
    "Informace o dopravě, platebních metodách a dodacích lhůtách v eshopu Janička.",
};

export default function ShippingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold text-foreground">
        Doprava a platba
      </h1>

      <div className="mt-8 space-y-8 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Způsoby dopravy
          </h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">
                  Zásilkovna — výdejní místo
                </h3>
                <span className="font-semibold text-foreground">69 Kč</span>
              </div>
              <p className="mt-1 text-sm">
                Doručení na vybrané výdejní místo nebo Z-BOX. Obvykle do 2–3
                pracovních dnů. Více než 10 000 výdejních míst v ČR.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">
                  Zásilkovna — na adresu
                </h3>
                <span className="font-semibold text-foreground">99 Kč</span>
              </div>
              <p className="mt-1 text-sm">
                Doručení přímo k vám domů. Obvykle do 2–3 pracovních dnů.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">Česká pošta</h3>
                <span className="font-semibold text-foreground">89 Kč</span>
              </div>
              <p className="mt-1 text-sm">
                Doporučený balík. Obvykle do 3–5 pracovních dnů.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Při objednávce nad <strong>1 500 Kč</strong> je doprava zdarma u
            všech způsobů doručení.
          </div>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Způsoby platby
          </h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">
                  Platba kartou online
                </h3>
                <span className="text-sm font-medium text-emerald-600">
                  zdarma
                </span>
              </div>
              <p className="mt-1 text-sm">
                Visa, Mastercard, Apple Pay, Google Pay. Platba je zpracována
                zabezpečeně přes platební bránu Comgate — vaše údaje o kartě
                nikdy nevidíme.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">
                  Bankovní převod
                </h3>
                <span className="text-sm font-medium text-emerald-600">
                  zdarma
                </span>
              </div>
              <p className="mt-1 text-sm">
                Online platba přes vaši banku. Po objednání vám vygenerujeme QR
                kód pro snadnou platbu v bankovní aplikaci. Zásilku odesíláme po
                přijetí platby.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">Dobírka</h3>
                <span className="text-sm font-medium text-foreground">
                  +39 Kč
                </span>
              </div>
              <p className="mt-1 text-sm">
                Platba při převzetí zásilky. K ceně objednávky se připočítá
                příplatek 39 Kč.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Důležité informace
          </h2>
          <ul className="mt-4 list-inside list-disc space-y-2">
            <li>
              Objednávky odesíláme obvykle do 1–2 pracovních dnů od přijetí
              platby (u platby kartou a převodem) nebo od potvrzení objednávky
              (u dobírky).
            </li>
            <li>
              O odeslání zásilky vás informujeme e-mailem včetně čísla pro
              sledování.
            </li>
            <li>
              Při objednávce nad 1 500 Kč je doprava zdarma.
            </li>
            <li>
              Zásilku si můžete sledovat přes{" "}
              <a
                href="/objednavka"
                className="text-primary underline"
              >
                vyhledání objednávky
              </a>
              .
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
