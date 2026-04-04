export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { PrintButton } from "@/components/shop/print-button";

export const metadata: Metadata = {
  title: "Formulář pro odstoupení od smlouvy | Janička",
  description:
    "Vzorový formulář pro odstoupení od kupní smlouvy do 14 dnů. Stáhněte, vyplňte a odešlete.",
};

export default function WithdrawalFormPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Navigation (hidden in print) */}
      <div className="mb-8 flex items-center justify-between print:hidden">
        <Link
          href="/returns"
          className="text-sm text-primary hover:underline"
        >
          &larr; Zpět na reklamace a vrácení
        </Link>
        <PrintButton />
      </div>

      {/* Form content */}
      <div className="rounded-xl border bg-card p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <h1 className="text-center font-heading text-2xl font-bold text-foreground">
          Vzorový formulář pro odstoupení od smlouvy
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground print:text-black">
          (vyplňte tento formulář a pošlete jej zpět pouze v případě, že chcete
          odstoupit od smlouvy)
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-foreground print:text-black">
          {/* Addressee */}
          <section>
            <p className="font-semibold">Oznámení o odstoupení od smlouvy</p>
            <div className="mt-3 rounded-lg border border-dashed p-4 print:rounded-none">
              <p className="font-medium">Adresát:</p>
              <p className="mt-1">Janička Shop</p>
              <p>E-mail: info@janicka.cz</p>
            </div>
          </section>

          {/* Declaration */}
          <section>
            <p>
              Oznamuji/oznamujeme(*), že tímto odstupuji/odstupujeme(*) od
              smlouvy o nákupu tohoto zboží:
            </p>
          </section>

          {/* Product details */}
          <section className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground print:text-black">
                Název zboží / číslo objednávky
              </label>
              <div className="mt-1 border-b-2 border-dotted pb-6 print:border-black" />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground print:text-black">
                Datum objednání / datum obdržení(*)
              </label>
              <div className="mt-1 border-b-2 border-dotted pb-6 print:border-black" />
            </div>
          </section>

          {/* Consumer details */}
          <section className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground print:text-black">
                Jméno a příjmení spotřebitele/spotřebitelů(*)
              </label>
              <div className="mt-1 border-b-2 border-dotted pb-6 print:border-black" />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground print:text-black">
                Adresa spotřebitele/spotřebitelů(*)
              </label>
              <div className="mt-1 border-b-2 border-dotted pb-6 print:border-black" />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground print:text-black">
                E-mail
              </label>
              <div className="mt-1 border-b-2 border-dotted pb-6 print:border-black" />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground print:text-black">
                Číslo bankovního účtu pro vrácení peněz (IBAN)
              </label>
              <div className="mt-1 border-b-2 border-dotted pb-6 print:border-black" />
            </div>
          </section>

          {/* Signature */}
          <section className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground print:text-black">
                Datum
              </label>
              <div className="mt-1 border-b-2 border-dotted pb-6 print:border-black" />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground print:text-black">
                Podpis spotřebitele/spotřebitelů (pouze pokud je formulář
                zasílán v listinné podobě)
              </label>
              <div className="mt-1 border-b-2 border-dotted pb-6 print:border-black" />
            </div>
          </section>

          {/* Footnote */}
          <p className="mt-6 text-xs text-muted-foreground print:text-gray-600">
            (*) Nehodící se škrtněte.
          </p>

          {/* Legal info */}
          <div className="mt-6 rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground print:bg-gray-50 print:text-gray-600">
            <p className="font-medium text-foreground print:text-black">
              Informace o právu na odstoupení:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>
                Máte právo odstoupit od kupní smlouvy do 14 dnů ode dne převzetí
                zboží bez udání důvodu (§ 1829 občanského zákoníku).
              </li>
              <li>
                Zboží musí být vráceno v nepoškozeném stavu, neprané a
                v&nbsp;původním obalu.
              </li>
              <li>
                U&nbsp;zboží zakoupeného jako second hand (použité) činí záruční
                doba 12 měsíců (§ 2167 občanského zákoníku).
              </li>
              <li>
                Náklady na vrácení zboží nese kupující, pokud se nejedná
                o&nbsp;oprávněnou reklamaci.
              </li>
              <li>
                Peníze vám vrátíme do 14 dnů od doručení vráceného zboží na
                uvedený bankovní účet.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Instructions (hidden in print) */}
      <div className="mt-8 rounded-xl border bg-muted/30 p-6 print:hidden">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Jak formulář použít
        </h2>
        <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-muted-foreground">
          <li>
            Klikněte na{" "}
            <strong className="text-foreground">Vytisknout formulář</strong>{" "}
            nebo použijte Ctrl+P pro tisk / uložení jako PDF.
          </li>
          <li>Vyplňte všechny údaje (název zboží, číslo objednávky, vaše jméno a adresu).</li>
          <li>
            Odešlete vyplněný formulář e-mailem na{" "}
            <strong className="text-foreground">info@janicka.cz</strong> nebo
            poštou na naši adresu.
          </li>
          <li>Zboží zabalte a odešlete na adresu, kterou vám sdělíme v potvrzení přijetí odstoupení.</li>
        </ol>
      </div>
    </div>
  );
}
