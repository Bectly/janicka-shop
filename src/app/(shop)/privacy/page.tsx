export const revalidate = 300;
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ochrana osobních údajů | Janička",
  description:
    "Zásady ochrany osobních údajů eshopu Janička. GDPR, zpracování dat, vaše práva.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold text-foreground">
        Ochrana osobních údajů
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Účinné od: [DOPLNIT DATUM]
      </p>

      <div className="mt-8 space-y-8 text-muted-foreground leading-relaxed">
        {/* 1. Správce */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            1. Správce osobních údajů
          </h2>
          <p>
            Správcem osobních údajů je provozovatel internetového obchodu Janička:
          </p>
          <div className="mt-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <p>[DOPLNIT JMÉNO / OBCHODNÍ NÁZEV]</p>
            <p>IČO: [DOPLNIT IČO]</p>
            <p>Sídlo: [DOPLNIT ADRESA]</p>
            <p>
              E-mail:{" "}
              <strong className="text-foreground">info@janicka.cz</strong>
            </p>
          </div>
          <p className="mt-3">
            Vaše osobní údaje zpracováváme v&nbsp;souladu s&nbsp;nařízením
            Evropského parlamentu a&nbsp;Rady (EU) 2016/679 (GDPR)
            a&nbsp;zákonem č.&nbsp;110/2019 Sb., o&nbsp;zpracování osobních
            údajů.
          </p>
        </section>

        {/* 2. Jaké údaje zpracováváme */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            2. Jaké údaje zpracováváme
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Jméno a příjmení</li>
            <li>E-mailová adresa</li>
            <li>Telefonní číslo (pouze u&nbsp;doručení na adresu)</li>
            <li>Doručovací adresa</li>
            <li>Údaje o&nbsp;objednávkách (obsah košíku, zvolená platba a&nbsp;doprava)</li>
            <li>IP adresa a&nbsp;technické údaje prohlížeče (pro zabezpečení a&nbsp;analytiku)</li>
            <li>
              Cookies a&nbsp;údaje o&nbsp;chování na webu (pouze s&nbsp;vaším
              souhlasem — viz bod 8)
            </li>
          </ul>
        </section>

        {/* 3. Účel a právní základ */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            3. Účel a právní základ zpracování
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-semibold text-foreground">
                    Účel
                  </th>
                  <th className="pb-2 font-semibold text-foreground">
                    Právní základ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2 pr-4">
                    Zpracování a&nbsp;doručení objednávky
                  </td>
                  <td className="py-2">
                    Plnění smlouvy (čl. 6 odst. 1 písm. b GDPR)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Komunikace ohledně objednávky (potvrzení, stav, doprava)
                  </td>
                  <td className="py-2">
                    Plnění smlouvy (čl. 6 odst. 1 písm. b GDPR)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Vyřízení reklamací a&nbsp;odstoupení od smlouvy
                  </td>
                  <td className="py-2">
                    Plnění smlouvy + zákonná povinnost
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Vedení účetnictví a&nbsp;daňové evidence
                  </td>
                  <td className="py-2">
                    Zákonná povinnost (čl. 6 odst. 1 písm. c GDPR)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Zasílání obchodních sdělení (novinky, slevy)
                  </td>
                  <td className="py-2">
                    Souhlas (čl. 6 odst. 1 písm. a GDPR)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    E-mail o&nbsp;opuštěném košíku
                  </td>
                  <td className="py-2">
                    Souhlas (čl. 6 odst. 1 písm. a GDPR) — pouze
                    s&nbsp;aktivním opt-in
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Zabezpečení webu (ochrana proti zneužití, rate limiting)
                  </td>
                  <td className="py-2">
                    Oprávněný zájem (čl. 6 odst. 1 písm. f GDPR)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Analytika návštěvnosti (anonymizovaná)
                  </td>
                  <td className="py-2">
                    Souhlas (čl. 6 odst. 1 písm. a GDPR) — cookies opt-in
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Příjemci údajů */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            4. Příjemci osobních údajů (zpracovatelé)
          </h2>
          <p>
            Vaše osobní údaje předáváme třetím stranám pouze v&nbsp;rozsahu
            nezbytném pro splnění účelu zpracování:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>
              <strong className="text-foreground">Comgate a.s.</strong> —
              zpracování plateb kartou a&nbsp;bankovním převodem (sídlo v&nbsp;ČR)
            </li>
            <li>
              <strong className="text-foreground">Zásilkovna s.r.o.</strong> —
              doručení zásilek (sídlo v&nbsp;ČR)
            </li>
            <li>
              <strong className="text-foreground">Česká pošta, s.p.</strong> —
              doručení zásilek (sídlo v&nbsp;ČR)
            </li>
            <li>
              <strong className="text-foreground">Resend, Inc.</strong> —
              odesílání transakčních e-mailů (sídlo v&nbsp;USA, standardní
              smluvní doložky EU)
            </li>
            <li>
              <strong className="text-foreground">UploadThing</strong> —
              ukládání fotografií produktů (sídlo v&nbsp;USA, standardní smluvní
              doložky EU)
            </li>
            <li>
              <strong className="text-foreground">Vercel Inc.</strong> — hosting
              a&nbsp;provoz webové aplikace (sídlo v&nbsp;USA, standardní smluvní
              doložky EU)
            </li>
          </ul>
          <p className="mt-3 text-sm">
            Údaje o&nbsp;vaší platební kartě zadáváte přímo na zabezpečené
            stránce Comgate — prodávající k&nbsp;nim nemá přístup a&nbsp;nikdy
            je neukládá.
          </p>
        </section>

        {/* 5. Doba uchovávání */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            5. Doba uchovávání údajů
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-2">
            <li>
              <strong className="text-foreground">
                Údaje pro plnění smlouvy
              </strong>{" "}
              (objednávky, doručovací údaje) — po dobu trvání smluvního vztahu
              a&nbsp;3 roky po jeho ukončení (promlčecí lhůta)
            </li>
            <li>
              <strong className="text-foreground">
                Účetní a&nbsp;daňové doklady
              </strong>{" "}
              — 5 let (resp. 10 let dle zákona o&nbsp;účetnictví)
            </li>
            <li>
              <strong className="text-foreground">Marketingová sdělení</strong>{" "}
              — do odvolání souhlasu
            </li>
            <li>
              <strong className="text-foreground">E-mail opuštěného košíku</strong>{" "}
              — maximálně 90 dní od opuštění košíku, poté automaticky smazáno
            </li>
            <li>
              <strong className="text-foreground">
                Analytická data (cookies)
              </strong>{" "}
              — dle nastavení konkrétní služby, maximálně 26 měsíců
            </li>
          </ul>
        </section>

        {/* 6. Vaše práva */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            6. Vaše práva
          </h2>
          <p>V&nbsp;souvislosti se zpracováním osobních údajů máte právo:</p>
          <ul className="mt-3 list-inside list-disc space-y-2">
            <li>
              <strong className="text-foreground">Na přístup</strong> — získat
              potvrzení, zda jsou vaše údaje zpracovávány, a&nbsp;kopii těchto
              údajů
            </li>
            <li>
              <strong className="text-foreground">Na opravu</strong> — požádat
              o&nbsp;opravu nepřesných nebo doplnění neúplných údajů
            </li>
            <li>
              <strong className="text-foreground">Na výmaz</strong> (právo být
              zapomenut) — požádat o&nbsp;smazání údajů, pokud pominul účel
              zpracování
            </li>
            <li>
              <strong className="text-foreground">Na omezení zpracování</strong>{" "}
              — požádat o&nbsp;omezení zpracování za určitých podmínek
            </li>
            <li>
              <strong className="text-foreground">Na přenositelnost</strong> —
              získat údaje ve strojově čitelném formátu a&nbsp;předat jinému
              správci
            </li>
            <li>
              <strong className="text-foreground">Vznést námitku</strong> —
              proti zpracování založenému na oprávněném zájmu
            </li>
            <li>
              <strong className="text-foreground">Odvolat souhlas</strong> —
              kdykoli odvolat souhlas se zpracováním, aniž by tím byla dotčena
              zákonnost zpracování před odvoláním
            </li>
          </ul>
          <p className="mt-3">
            Pro uplatnění svých práv nás kontaktujte na{" "}
            <strong className="text-foreground">info@janicka.cz</strong>. Na váš
            požadavek odpovíme nejpozději do 30 dnů.
          </p>
        </section>

        {/* 7. Zabezpečení */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            7. Zabezpečení údajů
          </h2>
          <p>
            Přijali jsme technická a&nbsp;organizační opatření k&nbsp;ochraně
            vašich osobních údajů. Webové stránky jsou chráněny šifrovaným
            protokolem HTTPS. Hesla jsou ukládána v&nbsp;hashované podobě.
            Přístup k&nbsp;osobním údajům je omezen pouze na oprávněné osoby.
          </p>
        </section>

        {/* 8. Cookies */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            8. Cookies
          </h2>
          <p>
            Naše stránky používají cookies pro správné fungování (funkční
            cookies pro košík, přihlášení a&nbsp;zabezpečení). Tyto cookies jsou
            nezbytné a&nbsp;nevyžadují souhlas.
          </p>
          <p className="mt-3">
            Analytické a&nbsp;marketingové cookies používáme pouze s&nbsp;vaším
            výslovným souhlasem, který můžete kdykoli odvolat v{" "}
            <strong className="text-foreground">nastavení cookies</strong>{" "}
            (odkaz v&nbsp;patičce stránky). Souhlas je udělen granulárně
            po&nbsp;kategoriích — můžete povolit analytiku bez marketingu
            a&nbsp;naopak.
          </p>
        </section>

        {/* 9. Marketingová sdělení */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            9. Marketingová sdělení
          </h2>
          <p>
            Obchodní sdělení (newslettery, informace o&nbsp;novinkách a slevách)
            zasíláme pouze na základě vašeho výslovného souhlasu (opt-in).
            Souhlas můžete kdykoli odvolat kliknutím na odkaz &bdquo;odhlásit
            se&ldquo; v&nbsp;každém zaslaném e-mailu nebo kontaktováním na{" "}
            <strong className="text-foreground">info@janicka.cz</strong>.
          </p>
          <p className="mt-3">
            E-maily o&nbsp;opuštěném košíku zasíláme pouze zákazníkům, kteří
            v&nbsp;průběhu objednávky aktivně zaškrtli souhlas s&nbsp;upozorněním.
            Tyto e-maily jsou omezeny na maximálně 3 zprávy a&nbsp;slouží
            k&nbsp;upozornění, že unikátní kus v&nbsp;košíku může být zakoupen
            někým jiným.
          </p>
        </section>

        {/* 10. Dozorový orgán */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            10. Dozorový orgán
          </h2>
          <p>
            Pokud se domníváte, že zpracováním vašich osobních údajů dochází
            k&nbsp;porušení GDPR, máte právo podat stížnost u&nbsp;dozorového
            úřadu:
          </p>
          <div className="mt-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium text-foreground">
              Úřad pro ochranu osobních údajů (ÚOOÚ)
            </p>
            <p>Pplk. Sochora 27, 170 00 Praha 7</p>
            <p>
              Web:{" "}
              <a
                href="https://www.uoou.cz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                www.uoou.cz
              </a>
            </p>
            <p>E-mail: posta@uoou.cz</p>
          </div>
        </section>

        {/* 11. Změny */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            11. Změny těchto zásad
          </h2>
          <p>
            Tyto zásady mohou být průběžně aktualizovány. O&nbsp;podstatných
            změnách vás budeme informovat prostřednictvím e-mailu nebo oznámením
            na webu. Datum poslední aktualizace je uvedeno v&nbsp;záhlaví tohoto
            dokumentu.
          </p>
        </section>

        {/* 12. Kontakt */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            12. Kontakt
          </h2>
          <p>
            V&nbsp;případě dotazů ohledně ochrany osobních údajů nás
            kontaktujte:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              E-mail:{" "}
              <strong className="text-foreground">info@janicka.cz</strong>
            </li>
            <li>
              <Link href="/contact" className="text-primary underline">
                Kontaktní formulář
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
