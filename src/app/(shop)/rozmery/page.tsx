import type { Metadata } from "next";
import Link from "next/link";
import { Ruler, Info } from "lucide-react";

export const metadata: Metadata = {
  title: "Tabulka velikostí — EU, UK, US, CZ | Janička",
  description:
    "Kompletní průvodce velikostmi dámského oblečení. Převodní tabulky CZ/EU/UK/US s rozměry v centimetrech pro topy, šaty, kalhoty, sukně, saka a bundy. Jak se správně změřit.",
  alternates: { canonical: "/rozmery" },
  openGraph: {
    title: "Tabulka velikostí dámského oblečení | Janička",
    description:
      "Převodní tabulky velikostí CZ/EU/UK/US s rozměry v centimetrech. Jak se správně změřit pro perfektní padnutí.",
    type: "article",
  },
};

type Row = {
  cz: string;
  eu: string;
  uk: string;
  us: string;
  bust?: string;
  waist?: string;
  hips?: string;
  inseam?: string;
};

// Standard women's apparel size conversion (CZ uses EU; UK = EU − 28; US = EU − 30).
// Body measurements in centimeters; ranges reflect typical fit windows.
const TOPS: Row[] = [
  { cz: "32", eu: "XXS / 32", uk: "4", us: "0", bust: "76–80", waist: "56–60", hips: "82–86" },
  { cz: "34", eu: "XS / 34", uk: "6", us: "2", bust: "80–84", waist: "60–64", hips: "86–90" },
  { cz: "36", eu: "S / 36", uk: "8", us: "4", bust: "84–88", waist: "64–68", hips: "90–94" },
  { cz: "38", eu: "M / 38", uk: "10", us: "6", bust: "88–92", waist: "68–72", hips: "94–98" },
  { cz: "40", eu: "L / 40", uk: "12", us: "8", bust: "92–96", waist: "72–76", hips: "98–102" },
  { cz: "42", eu: "XL / 42", uk: "14", us: "10", bust: "96–100", waist: "76–80", hips: "102–106" },
  { cz: "44", eu: "XXL / 44", uk: "16", us: "12", bust: "100–104", waist: "80–84", hips: "106–110" },
  { cz: "46", eu: "3XL / 46", uk: "18", us: "14", bust: "104–108", waist: "84–88", hips: "110–114" },
  { cz: "48", eu: "4XL / 48", uk: "20", us: "16", bust: "108–112", waist: "88–92", hips: "114–118" },
  { cz: "50", eu: "5XL / 50", uk: "22", us: "18", bust: "112–116", waist: "92–96", hips: "118–122" },
];

const DRESSES: Row[] = TOPS;

const BOTTOMS: Row[] = [
  { cz: "32", eu: "XXS / 32", uk: "4", us: "0", waist: "56–60", hips: "82–86", inseam: "75" },
  { cz: "34", eu: "XS / 34", uk: "6", us: "2", waist: "60–64", hips: "86–90", inseam: "76" },
  { cz: "36", eu: "S / 36", uk: "8", us: "4", waist: "64–68", hips: "90–94", inseam: "77" },
  { cz: "38", eu: "M / 38", uk: "10", us: "6", waist: "68–72", hips: "94–98", inseam: "78" },
  { cz: "40", eu: "L / 40", uk: "12", us: "8", waist: "72–76", hips: "98–102", inseam: "79" },
  { cz: "42", eu: "XL / 42", uk: "14", us: "10", waist: "76–80", hips: "102–106", inseam: "80" },
  { cz: "44", eu: "XXL / 44", uk: "16", us: "12", waist: "80–84", hips: "106–110", inseam: "81" },
  { cz: "46", eu: "3XL / 46", uk: "18", us: "14", waist: "84–88", hips: "110–114", inseam: "82" },
  { cz: "48", eu: "4XL / 48", uk: "20", us: "16", waist: "88–92", hips: "114–118", inseam: "83" },
  { cz: "50", eu: "5XL / 50", uk: "22", us: "18", waist: "92–96", hips: "118–122", inseam: "84" },
];

// Saka/bundy (outerwear) — bust dominates, includes a touch more ease.
const OUTERWEAR: Row[] = [
  { cz: "32", eu: "XXS / 32", uk: "4", us: "0", bust: "78–82", waist: "58–62", hips: "84–88" },
  { cz: "34", eu: "XS / 34", uk: "6", us: "2", bust: "82–86", waist: "62–66", hips: "88–92" },
  { cz: "36", eu: "S / 36", uk: "8", us: "4", bust: "86–90", waist: "66–70", hips: "92–96" },
  { cz: "38", eu: "M / 38", uk: "10", us: "6", bust: "90–94", waist: "70–74", hips: "96–100" },
  { cz: "40", eu: "L / 40", uk: "12", us: "8", bust: "94–98", waist: "74–78", hips: "100–104" },
  { cz: "42", eu: "XL / 42", uk: "14", us: "10", bust: "98–102", waist: "78–82", hips: "104–108" },
  { cz: "44", eu: "XXL / 44", uk: "16", us: "12", bust: "102–106", waist: "82–86", hips: "108–112" },
  { cz: "46", eu: "3XL / 46", uk: "18", us: "14", bust: "106–110", waist: "86–90", hips: "112–116" },
  { cz: "48", eu: "4XL / 48", uk: "20", us: "16", bust: "110–114", waist: "90–94", hips: "116–120" },
  { cz: "50", eu: "5XL / 50", uk: "22", us: "18", bust: "114–118", waist: "94–98", hips: "120–124" },
];

const FAQ = [
  {
    q: "Jak se převádějí velikosti CZ, EU, UK a US?",
    a: "Česká velikost odpovídá evropské (např. CZ 38 = EU 38 = M). UK velikost získáte odečtením 28 od evropské (EU 38 = UK 10), americká odečtením 30 (EU 38 = US 8). Tyto převody platí pro standardní dámské oblečení.",
  },
  {
    q: "Jak se mám správně změřit?",
    a: "Měřte se v lehkém spodním prádle, krejčovským metrem nataženým rovně, ale ne zatahnutým. Prsa měřte přes nejširší místo hrudníku, pas přes nejužší místo trupu, boky přes nejširší místo přes zadek.",
  },
  {
    q: "Proč mají rozměry second hand kusů odchylky?",
    a: "U second hand oblečení se rozměry mohou mírně lišit podle konkrétní značky, modelu a opotřebení. U každého kusu proto uvádíme změřené rozměry v centimetrech (na ploše, nenatažené). Odchylka ± 1–2 cm je normální.",
  },
  {
    q: "Můžu vrátit kus, který mi nepadne?",
    a: "Ano. Máte 14 dní na vrácení bez udání důvodu. Postup naleznete na stránce reklamace.",
  },
];

function ConversionTable({
  rows,
  showBust = true,
  showInseam = false,
}: {
  rows: Row[];
  showBust?: boolean;
  showInseam?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">CZ</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">EU</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">UK</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">US</th>
            {showBust && (
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prsa (cm)</th>
            )}
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pas (cm)</th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Boky (cm)</th>
            {showInseam && (
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Délka (cm)</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cz} className="border-b border-border last:border-0 transition-colors duration-150 hover:bg-muted/30">
              <td className="px-3 py-2.5 font-semibold tabular-nums">{r.cz}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{r.eu}</td>
              <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{r.uk}</td>
              <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{r.us}</td>
              {showBust && (
                <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{r.bust ?? "—"}</td>
              )}
              <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{r.waist ?? "—"}</td>
              <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{r.hips ?? "—"}</td>
              {showInseam && (
                <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{r.inseam ?? "—"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RozmeryPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mb-10 flex flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
          <Ruler className="size-3" />
          Průvodce velikostmi
        </span>
        <h1 className="font-heading text-[1.75rem] font-bold text-foreground sm:text-3xl">
          Tabulka velikostí
        </h1>
        <p className="text-muted-foreground">
          Převodní tabulky CZ/EU/UK/US s rozměry v centimetrech. U každého
          second hand kusu navíc najdete přesně změřené rozměry.
        </p>
      </div>

      <div className="mb-8 flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <Info className="size-4 shrink-0 text-primary" />
        <p className="text-muted-foreground leading-relaxed">
          Rozměry v tabulkách jsou <strong className="text-foreground">tělesné</strong>{" "}
          (vaše míry), ne rozměry kusu. U konkrétního produktu vždy zkontrolujte{" "}
          <strong className="text-foreground">změřené rozměry kusu na ploše</strong>{" "}
          uvedené na detailu produktu — u second hand oblečení se mohou
          jednotlivé kousky lišit i v rámci stejné velikosti.
        </p>
      </div>

      <div className="space-y-12">
        <section id="topy">
          <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">
            Topy a halenky
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Trička, halenky, košile, svetry, mikiny.
          </p>
          <ConversionTable rows={TOPS} showBust />
        </section>

        <section id="saty">
          <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">
            Šaty
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Krátké, midi i dlouhé šaty. Velikost vybírejte podle nejširšího
            místa (obvykle prsa nebo boky).
          </p>
          <ConversionTable rows={DRESSES} showBust />
        </section>

        <section id="kalhoty-sukne">
          <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">
            Kalhoty a sukně
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Délka nohavice je orientační — u jeansů a klasických kalhot se může
            lišit podle modelu (regular, cropped, long).
          </p>
          <ConversionTable rows={BOTTOMS} showBust={false} showInseam />
        </section>

        <section id="saka-bundy">
          <h2 className="mb-3 font-heading text-xl font-semibold text-foreground">
            Saka a bundy
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Saka, blejzry, kabáty, bundy. U vrchního ošacení počítejte s tím, že
            se nosí přes další vrstvu — můžete jít o číslo větší.
          </p>
          <ConversionTable rows={OUTERWEAR} showBust />
        </section>

        <section className="rounded-xl border border-border bg-muted/30 p-6">
          <h2 className="mb-4 font-heading text-xl font-semibold text-foreground">
            Jak se správně změřit
          </h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              <strong className="text-foreground">Prsa</strong> — krejčovský
              metr veďte vodorovně přes nejširší místo hrudníku, pod paží.
            </li>
            <li>
              <strong className="text-foreground">Pas</strong> — měřte v
              nejužším místě trupu, obvykle nad pupkem.
            </li>
            <li>
              <strong className="text-foreground">Boky</strong> — vodorovně přes
              nejširší místo přes zadek.
            </li>
            <li>
              <strong className="text-foreground">Délka nohavice (inseam)</strong>{" "}
              — od rozkroku po kotník po vnitřní straně nohy.
            </li>
            <li>
              <strong className="text-foreground">Tip:</strong> měřte se v
              lehkém spodním prádle a metr nezatahujte — má rovně přiléhat k
              tělu.
            </li>
          </ul>
        </section>

        <section id="faq">
          <h2 className="mb-4 font-heading text-xl font-semibold text-foreground">
            Časté dotazy
          </h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-lg border border-border bg-card p-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-foreground">
                  <span>{item.q}</span>
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground transition-transform duration-150 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-primary/15 bg-primary/[0.04] p-6 text-center">
          <h2 className="mb-2 font-heading text-lg font-semibold text-foreground">
            Stále si nejste jistí?
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Napište nám — rádi vám poradíme s výběrem velikosti konkrétního
            kusu.
          </p>
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
          >
            Kontaktujte nás
          </Link>
        </section>
      </div>
    </div>
  );
}
