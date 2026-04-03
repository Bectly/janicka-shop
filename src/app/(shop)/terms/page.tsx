import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Obchodní podmínky | Janička",
  description: "Obchodní podmínky eshopu Janička — second hand oblečení.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold text-foreground">
        Obchodní podmínky
      </h1>

      <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            1. Obecná ustanovení
          </h2>
          <p>
            Tyto obchodní podmínky upravují práva a povinnosti smluvních stran
            při nákupu zboží prostřednictvím internetového obchodu Janička.
            Provozovatelem eshopu je fyzická osoba podnikající.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            2. Objednávka a uzavření smlouvy
          </h2>
          <p>
            Odesláním objednávky kupující potvrzuje, že se seznámil s těmito
            obchodními podmínkami a že s nimi souhlasí. Objednávka je návrhem
            kupní smlouvy. Kupní smlouva vzniká potvrzením objednávky
            prodávajícím.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            3. Specifika second hand zboží
          </h2>
          <p>
            Veškeré zboží v nabídce je použité (second hand), pokud není uvedeno
            jinak. U každého produktu je uveden jeho aktuální stav. Kupující
            bere na vědomí, že zboží může vykazovat známky předchozího nošení
            odpovídající uvedenému stavu.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Nové s visačkou</strong> — nenošené, s původní visačkou
            </li>
            <li>
              <strong>Výborný stav</strong> — minimální známky nošení
            </li>
            <li>
              <strong>Dobrý stav</strong> — mírné známky nošení
            </li>
            <li>
              <strong>Viditelné opotřebení</strong> — patrné stopy použití,
              vždy detailně popsáno
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            4. Ceny a platba
          </h2>
          <p>
            Všechny ceny jsou uvedeny v českých korunách (CZK) včetně DPH.
            K ceně zboží je připočteno poštovné dle zvoleného způsobu dopravy.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            5. Dodání zboží
          </h2>
          <p>
            Zboží je odesíláno obvykle do 1–2 pracovních dnů od přijetí platby
            nebo potvrzení objednávky na dobírku. Dodací lhůta závisí na
            zvoleném způsobu dopravy.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            6. Odstoupení od smlouvy
          </h2>
          <p>
            Kupující má právo odstoupit od smlouvy do 14 dnů od převzetí zboží
            bez udání důvodu. Zboží musí být vráceno v nepoškozeném stavu.
            Náklady na vrácení zboží nese kupující.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            7. Reklamace
          </h2>
          <p>
            Reklamaci je možné uplatnit v případě, že zboží neodpovídá
            uvedenému popisu nebo stavu. Podrobnosti naleznete na stránce{" "}
            <a href="/returns" className="text-primary underline">
              Reklamace
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            8. Závěrečná ustanovení
          </h2>
          <p>
            Tyto obchodní podmínky nabývají účinnosti dnem jejich zveřejnění.
            Prodávající si vyhrazuje právo obchodní podmínky měnit.
            Rozhodujícím právním řádem je právo České republiky.
          </p>
        </section>
      </div>
    </div>
  );
}
