export const dynamic = "force-dynamic";
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
                Doručení na vybrané výdejní místo. Obvykle do 2–3 pracovních
                dnů.
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
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Způsoby platby
          </h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-medium text-foreground">Dobírka</h3>
              <p className="mt-1 text-sm">
                Platba při převzetí zásilky. Příplatek 30 Kč.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h3 className="font-medium text-foreground">
                Bankovní převod
              </h3>
              <p className="mt-1 text-sm">
                Po objednání vám zašleme platební údaje e-mailem. Zásilku
                odesíláme po přijetí platby.
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
              platby.
            </li>
            <li>
              O odeslání zásilky vás informujeme e-mailem včetně čísla pro
              sledování.
            </li>
            <li>
              Při objednávce nad 1 500 Kč je doprava zdarma.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
