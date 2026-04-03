import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reklamace a vrácení | Janička",
  description:
    "Informace o reklamaci a vrácení zboží v eshopu Janička. 14 dní na vrácení.",
};

export default function ReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold text-foreground">
        Reklamace a vrácení zboží
      </h1>

      <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Vrácení zboží do 14 dnů
          </h2>
          <p>
            Máte právo odstoupit od kupní smlouvy do 14 dnů od převzetí zboží
            bez udání důvodu. Zboží musí být vráceno v nepoškozeném stavu,
            ideálně v původním obalu.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Jak vrátit zboží
          </h2>
          <ol className="mt-2 list-inside list-decimal space-y-2">
            <li>
              Kontaktujte nás e-mailem na{" "}
              <strong className="text-foreground">info@janicka.cz</strong> s
              číslem objednávky a důvodem vrácení.
            </li>
            <li>
              Zboží zabalte tak, aby nedošlo k poškození při přepravě.
            </li>
            <li>
              Zásilku odešlete na adresu, kterou vám sdělíme v odpovědi.
            </li>
            <li>
              Po přijetí a kontrole zboží vám vrátíme peníze na účet do 14 dnů.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Reklamace
          </h2>
          <p>
            Reklamaci můžete uplatnit, pokud zboží neodpovídá popisu nebo
            uvedenému stavu. Vzhledem k tomu, že se jedná o second hand zboží,
            nelze reklamovat běžné známky opotřebení odpovídající uvedenému
            stavu produktu.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Co lze reklamovat
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              Zboží neodpovídá popisu (jiná velikost, barva, značka)
            </li>
            <li>Skryté vady neuvedené v popisu produktu</li>
            <li>Poškození při přepravě</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Co nelze reklamovat
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Běžné známky nošení odpovídající uvedenému stavu</li>
            <li>Změna názoru na barvu, střih nebo materiál</li>
            <li>Zboží poškozené kupujícím po převzetí</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Náklady na vrácení
          </h2>
          <p>
            Poštovné za vrácení zboží hradí kupující, pokud se nejedná o
            oprávněnou reklamaci. V případě oprávněné reklamace hradíme
            poštovné my.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Kontakt pro reklamace
          </h2>
          <p>
            E-mail:{" "}
            <strong className="text-foreground">info@janicka.cz</strong>
          </p>
          <p className="mt-1">
            Nebo využijte náš{" "}
            <a href="/contact" className="text-primary underline">
              kontaktní formulář
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
