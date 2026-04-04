export const dynamic = "force-dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ochrana osobních údajů | Janička",
  description:
    "Zásady ochrany osobních údajů eshopu Janička. Jak nakládáme s vašimi daty.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold text-foreground">
        Ochrana osobních údajů
      </h1>

      <div className="mt-8 space-y-6 text-muted-foreground leading-relaxed">
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            1. Správce osobních údajů
          </h2>
          <p>
            Správcem osobních údajů je provozovatel internetového obchodu
            Janička. Vaše osobní údaje zpracováváme v souladu s nařízením GDPR
            a zákonem č. 110/2019 Sb.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            2. Jaké údaje shromažďujeme
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Jméno a příjmení</li>
            <li>E-mailová adresa</li>
            <li>Telefonní číslo</li>
            <li>Doručovací adresa</li>
            <li>Historie objednávek</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            3. Účel zpracování
          </h2>
          <p>Vaše osobní údaje zpracováváme za účelem:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Zpracování a doručení objednávky</li>
            <li>Komunikace ohledně objednávky</li>
            <li>
              Zasílání obchodních sdělení (pouze s vaším souhlasem)
            </li>
            <li>Plnění zákonných povinností (účetnictví, daně)</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            4. Doba uchovávání
          </h2>
          <p>
            Osobní údaje uchováváme po dobu nezbytnou k plnění smlouvy a
            zákonných povinností. Údaje pro účetní účely uchováváme po dobu
            stanovenou zákonem (obvykle 5 let). Údaje pro marketing
            zpracováváme do odvolání souhlasu.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            5. Vaše práva
          </h2>
          <p>Máte právo:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Na přístup ke svým osobním údajům</li>
            <li>Na opravu nepřesných údajů</li>
            <li>Na výmaz údajů (právo být zapomenut)</li>
            <li>Na omezení zpracování</li>
            <li>Na přenositelnost údajů</li>
            <li>Vznést námitku proti zpracování</li>
            <li>Odvolat souhlas se zpracováním</li>
          </ul>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            6. Cookies
          </h2>
          <p>
            Naše stránky používají cookies pro zajištění správného fungování
            (funkční cookies pro košík a přihlášení). Analytické cookies
            používáme pouze s vaším souhlasem.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            7. Kontakt
          </h2>
          <p>
            V případě dotazů ohledně ochrany osobních údajů nás kontaktujte
            prostřednictvím{" "}
            <a href="/contact" className="text-primary underline">
              kontaktního formuláře
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
