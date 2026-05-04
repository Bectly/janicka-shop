import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Obchodní podmínky | Janička",
  description:
    "Obchodní podmínky eshopu Janička — second hand oblečení. Platební podmínky, doprava, reklamace, odstoupení od smlouvy.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-bold text-foreground">
        Obchodní podmínky
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Účinné od: 1. 5. 2026
      </p>

      <div className="mt-8 space-y-8 text-muted-foreground leading-relaxed">
        {/* 1. Úvodní ustanovení */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            1. Úvodní ustanovení
          </h2>
          <p>
            Tyto obchodní podmínky (dále jen &bdquo;podmínky&ldquo;) upravují
            vzájemná práva a povinnosti smluvních stran vzniklé v&nbsp;souvislosti
            s&nbsp;uzavíráním kupní smlouvy prostřednictvím internetového obchodu
            Janička na adrese{" "}
            <strong className="text-foreground">janicka.cz</strong> (dále jen
            &bdquo;e-shop&ldquo;).
          </p>
          <div className="mt-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium text-foreground">Prodávající:</p>
            <p>[DOPLNIT JMÉNO / OBCHODNÍ NÁZEV]</p>
            <p>IČO: [DOPLNIT IČO]</p>
            <p>Sídlo: [DOPLNIT ADRESA]</p>
            <p>
              E-mail:{" "}
              <strong className="text-foreground">info@jvsatnik.cz</strong>
            </p>
            <p className="mt-2 text-xs">
              Prodávající není plátcem DPH, pokud není uvedeno jinak.
            </p>
          </div>
          <p className="mt-3">
            Podmínky se vztahují na kupní smlouvy uzavírané mezi prodávajícím
            a&nbsp;fyzickou osobou (spotřebitelem) ve smyslu zákona
            č.&nbsp;89/2012 Sb., občanský zákoník (dále jen &bdquo;OZ&ldquo;),
            a&nbsp;zákona č.&nbsp;634/1992 Sb., o&nbsp;ochraně spotřebitele.
          </p>
        </section>

        {/* 2. Specifika second hand zboží */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            2. Specifika second hand zboží
          </h2>
          <p>
            Veškeré zboží v&nbsp;nabídce e-shopu je použité (second hand), pokud
            není u&nbsp;konkrétního produktu výslovně uvedeno jinak. Každý kus je{" "}
            <strong className="text-foreground">unikát</strong> — je dostupný
            pouze v&nbsp;jednom exempláři. Po prodeji se produkt automaticky
            stává nedostupným.
          </p>
          <p className="mt-3">
            U&nbsp;každého produktu je uveden jeho aktuální stav dle následující
            klasifikace:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong className="text-foreground">Nové s visačkou</strong> —
              nenošené, s&nbsp;původní visačkou
            </li>
            <li>
              <strong className="text-foreground">Nové bez visačky</strong> —
              nepoužité zboží bez originální visačky
            </li>
            <li>
              <strong className="text-foreground">Výborný stav</strong> —
              minimální známky nošení
            </li>
            <li>
              <strong className="text-foreground">Dobrý stav</strong> — mírné
              známky nošení
            </li>
            <li>
              <strong className="text-foreground">Viditelné opotřebení</strong>{" "}
              — patrné stopy použití, vždy detailně popsáno v&nbsp;popisu
              produktu
            </li>
          </ul>
          <p className="mt-3">
            Kupující bere na vědomí, že zboží může vykazovat známky předchozího
            nošení odpovídající uvedenému stavu. Případné vady výslovně uvedené
            v&nbsp;popisu produktu nejsou důvodem k&nbsp;reklamaci.
          </p>
        </section>

        {/* 3. Objednávka a uzavření smlouvy */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            3. Objednávka a uzavření kupní smlouvy
          </h2>
          <p>
            Nabídka zboží v&nbsp;e-shopu je nezávazným návrhem k&nbsp;uzavření
            smlouvy. Objednávku kupující vytvoří vyplněním objednávkového
            formuláře a&nbsp;jeho odesláním. Odesláním objednávky kupující
            potvrzuje, že se seznámil s&nbsp;těmito podmínkami a&nbsp;že s&nbsp;nimi
            souhlasí.
          </p>
          <p className="mt-3">
            Kupní smlouva vzniká okamžikem přijetí objednávky prodávajícím.
            Přijetí objednávky je potvrzeno automatickým e-mailem zaslaným na
            adresu uvedenou kupujícím.
          </p>
          <p className="mt-3">
            Prodávající si vyhrazuje právo objednávku odmítnout, pokud zboží
            již není dostupné (bylo prodáno jinému kupujícímu). O&nbsp;této
            skutečnosti bude kupující neprodleně informován.
          </p>
        </section>

        {/* 4. Ceny */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            4. Ceny a platební podmínky
          </h2>
          <p>
            Všechny ceny zboží jsou uvedeny v&nbsp;českých korunách (CZK) včetně
            všech daní a&nbsp;poplatků. Cena zboží je platná v&nbsp;okamžiku
            odeslání objednávky.
          </p>
          <p className="mt-3">
            Při zobrazení slevy je vždy uvedena nejnižší cena, za kterou bylo
            zboží prodáváno v&nbsp;posledních 30 dnech před slevou, v&nbsp;souladu
            se zákonem o&nbsp;ochraně spotřebitele.
          </p>

          <h3 className="mt-4 font-medium text-foreground">
            Přijímané platební metody:
          </h3>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm">
              <span>
                <strong className="text-foreground">Platba kartou online</strong>{" "}
                — Visa, Mastercard, Apple Pay, Google Pay
              </span>
              <span className="shrink-0 font-medium text-foreground">
                zdarma
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm">
              <span>
                <strong className="text-foreground">Bankovní převod</strong>{" "}
                — online platba přes vaši banku
              </span>
              <span className="shrink-0 font-medium text-foreground">
                zdarma
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm">
              <span>
                <strong className="text-foreground">Dobírka</strong> — platba při
                převzetí zásilky
              </span>
              <span className="shrink-0 font-medium text-foreground">
                +39 Kč
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm">
            Platby kartou a&nbsp;bankovním převodem jsou zpracovávány
            prostřednictvím platební brány{" "}
            <strong className="text-foreground">Comgate</strong>. Údaje o platební
            kartě jsou zadávány přímo na zabezpečené stránce Comgate — prodávající
            nemá k&nbsp;údajům o&nbsp;kartě přístup.
          </p>
        </section>

        {/* 5. Doprava */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            5. Dodání zboží
          </h2>
          <p>
            Zboží je odesíláno obvykle do 1–2 pracovních dnů od přijetí platby
            (u&nbsp;platby kartou a&nbsp;převodem) nebo od potvrzení objednávky
            (u&nbsp;dobírky). Prodávající je povinen dodat zboží nejpozději do
            30 dnů od uzavření smlouvy, pokud se smluvní strany nedohodly jinak.
          </p>

          <h3 className="mt-4 font-medium text-foreground">
            Způsoby dopravy:
          </h3>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm">
              <div>
                <strong className="text-foreground">
                  Zásilkovna — výdejní místo
                </strong>
                <p className="text-xs text-muted-foreground">
                  Vyzvednutí na vybraném místě, obvykle 2–3 pracovní dny
                </p>
              </div>
              <span className="shrink-0 font-medium text-foreground">
                69 Kč
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm">
              <div>
                <strong className="text-foreground">
                  Zásilkovna — na adresu
                </strong>
                <p className="text-xs text-muted-foreground">
                  Doručení domů, obvykle 2–3 pracovní dny
                </p>
              </div>
              <span className="shrink-0 font-medium text-foreground">
                99 Kč
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm">
              <div>
                <strong className="text-foreground">Česká pošta</strong>
                <p className="text-xs text-muted-foreground">
                  Doporučený balík, obvykle 3–5 pracovních dnů
                </p>
              </div>
              <span className="shrink-0 font-medium text-foreground">
                89 Kč
              </span>
            </div>
          </div>
          <p className="mt-3 text-sm">
            Při objednávce v&nbsp;hodnotě nad{" "}
            <strong className="text-foreground">1 500 Kč</strong> je doprava
            zdarma u&nbsp;všech způsobů doručení.
          </p>
        </section>

        {/* 6. Odstoupení od smlouvy */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            6. Odstoupení od smlouvy
          </h2>
          <p>
            Kupující (spotřebitel) má právo odstoupit od kupní smlouvy bez udání
            důvodu ve lhůtě{" "}
            <strong className="text-foreground">14 dnů</strong> ode dne převzetí
            zboží, v&nbsp;souladu s&nbsp;§&nbsp;1829 OZ.
          </p>
          <p className="mt-3">
            Pro odstoupení od smlouvy může kupující využít{" "}
            <Link
              href="/returns/withdrawal-form"
              className="text-primary underline"
            >
              vzorový formulář pro odstoupení
            </Link>
            , který je rovněž dostupný na stránce{" "}
            <Link href="/returns" className="text-primary underline">
              Reklamace a vrácení
            </Link>
            . Formulář je třeba odeslat na adresu{" "}
            <strong className="text-foreground">info@jvsatnik.cz</strong>.
          </p>
          <p className="mt-3">
            Zboží musí být vráceno nepoškozené, neprané, bez známek dalšího
            použití po převzetí. Náklady na vrácení zboží nese kupující. Peníze
            budou vráceny do 14 dnů od obdržení vráceného zboží na bankovní účet
            kupujícího.
          </p>
          <p className="mt-3 text-sm">
            Pokud prodávající neinformoval spotřebitele o&nbsp;právu na
            odstoupení, lhůta pro odstoupení se prodlužuje o&nbsp;12 měsíců
            (§&nbsp;1829 odst.&nbsp;2 OZ).
          </p>
        </section>

        {/* 7. Práva z vadného plnění */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            7. Práva z vadného plnění (reklamace)
          </h2>
          <p>
            Prodávající odpovídá kupujícímu za to, že zboží při převzetí nemá
            vady a&nbsp;odpovídá popisu uvedenému na e-shopu.
          </p>
          <p className="mt-3">
            U&nbsp;použitého zboží (second hand) činí záruční doba{" "}
            <strong className="text-foreground">12 měsíců</strong> ode dne
            převzetí zboží (§&nbsp;2167 OZ). Vady výslovně uvedené v&nbsp;popisu
            produktu (odpovídající uvedenému stavu) nelze reklamovat.
          </p>
          <p className="mt-3">
            Reklamaci lze uplatnit e-mailem na{" "}
            <strong className="text-foreground">info@jvsatnik.cz</strong>.
            Prodávající je povinen reklamaci vyřídit nejpozději do{" "}
            <strong className="text-foreground">30 dnů</strong> ode dne jejího
            uplatnění, pokud se smluvní strany nedohodly na lhůtě delší.
          </p>
          <p className="mt-3">
            Podrobné informace o&nbsp;reklamačním procesu naleznete na stránce{" "}
            <Link href="/returns" className="text-primary underline">
              Reklamace a vrácení
            </Link>
            .
          </p>
        </section>

        {/* 8. Ochrana osobních údajů */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            8. Ochrana osobních údajů
          </h2>
          <p>
            Osobní údaje kupujícího jsou zpracovávány v&nbsp;souladu s&nbsp;nařízením
            GDPR a&nbsp;zákonem č.&nbsp;110/2019 Sb. Podrobnosti o&nbsp;zpracování
            osobních údajů, účelech, právním základu, době uchovávání a&nbsp;právech
            kupujícího jsou uvedeny v&nbsp;samostatném dokumentu{" "}
            <Link href="/privacy" className="text-primary underline">
              Ochrana osobních údajů
            </Link>
            .
          </p>
        </section>

        {/* 9. Mimosoudní řešení sporů */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            9. Mimosoudní řešení spotřebitelských sporů
          </h2>
          <p>
            K&nbsp;mimosoudnímu řešení spotřebitelských sporů z&nbsp;kupní
            smlouvy je příslušná{" "}
            <strong className="text-foreground">
              Česká obchodní inspekce (ČOI)
            </strong>
            , se sídlem Štěpánská 567/15, 120 00 Praha 2,{" "}
            <a
              href="https://www.coi.cz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              www.coi.cz
            </a>
            .
          </p>
          <p className="mt-3">
            Spotřebitel může rovněž využít platformu pro řešení sporů online
            (ODR) zřízenou Evropskou komisí na adrese{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              ec.europa.eu/consumers/odr
            </a>
            .
          </p>
        </section>

        {/* 10. Závěrečná ustanovení */}
        <section>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            10. Závěrečná ustanovení
          </h2>
          <p>
            Tyto obchodní podmínky nabývají účinnosti dnem jejich zveřejnění na
            webových stránkách e-shopu. Prodávající si vyhrazuje právo obchodní
            podmínky měnit. Změna podmínek se nedotýká práv a&nbsp;povinností
            vzniklých za účinnosti předchozího znění.
          </p>
          <p className="mt-3">
            Právní vztahy těmito podmínkami výslovně neupravené se řídí příslušnými
            ustanoveními OZ, zákona o&nbsp;ochraně spotřebitele a&nbsp;dalšími
            právními předpisy České republiky.
          </p>
          <p className="mt-3">
            Je-li některé ustanovení těchto podmínek neplatné, neúčinné nebo
            nepoužitelné, nemá to vliv na platnost ostatních ustanovení.
          </p>
        </section>
      </div>
    </div>
  );
}
