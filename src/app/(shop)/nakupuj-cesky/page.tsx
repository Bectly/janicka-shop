import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Package,
  Clock,
  MapPin,
  ArrowRight,
  Leaf,
  TrendingUp,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Proč nakupovat lokálně? | Janička",
  description:
    "Od července 2026 se mění pravidla dovozu do EU. Nakupuj u Janičky — bez cel, ověřená kvalita, doručení do 3 dnů. Žádná překvapení na hranici.",
  openGraph: {
    title: "Nakupuj česky — žádná cla, žádná překvapení",
    description:
      "Od července 2026 platí nová cla na zásilky ze zahraničí. U Janičky nakupuješ lokálně — bez poplatků navíc, s garancí kvality.",
    type: "website",
    locale: "cs_CZ",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nakupuj česky — žádná cla, žádná překvapení",
    description:
      "Od července 2026 platí nová cla na zásilky ze zahraničí. U Janičky nakupuješ lokálně — bez poplatků navíc, s garancí kvality.",
  },
};

const comparisonItems = [
  {
    topic: "Cena bez překvapení",
    icon: Package,
    abroad:
      "Od 1. července 2026 platíš navíc minimálně 75 Kč (€3) clo za každou kategorii zboží. Plus DPH, plus poštovné ze zahraničí. Konečná cena? Zjistíš až u doručení.",
    janicka:
      "Cena, kterou vidíš, je cena, kterou zaplatíš. Žádná cla, žádné skryté poplatky. Doprava od 69 Kč, nad 1 500 Kč zdarma.",
  },
  {
    topic: "Kvalita a stav",
    icon: ShieldCheck,
    abroad:
      "Fotky neodpovídají realitě. Materiál jiný, než popisek sliboval. Reklamace? Posíláš balík zpátky do Číny na vlastní náklady.",
    janicka:
      "Každý kousek osobně kontrolujeme a fotíme. Poctivý popis stavu — víš přesně, co kupuješ. Reklamace vyřídíme do 30 dnů.",
  },
  {
    topic: "Doručení",
    icon: Clock,
    abroad:
      "2–6 týdnů čekání. Zásilka může uvíznout na celnici. Od července navíc celní řízení pro každý balík — další zdržení.",
    janicka:
      "Odesíláme do 2 pracovních dnů. Doručení přes Zásilkovnu do 3 dnů kamkoliv v ČR. Sledování zásilky v reálném čase.",
  },
];

const benefits = [
  {
    icon: Leaf,
    title: "Udržitelnost",
    text: "Žádná zbytečná doprava přes půl světa. Lokální nákup = menší uhlíková stopa.",
  },
  {
    icon: MapPin,
    title: "Podpora lokální ekonomiky",
    text: "Tvoje peníze zůstávají v Česku. Podporuješ malé podnikání, ne mezinárodní korporace.",
  },
  {
    icon: TrendingUp,
    title: "Chytrý nákup",
    text: "Second hand = ušetříš až 70 % oproti nové ceně. A ještě pomáháš planetě.",
  },
];

export default function NakupujCeskyPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-sage-light/30 to-white" />
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pb-20 sm:pt-28 lg:px-8">
          {/* Editorial pill-badge */}
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sage-dark/20 bg-sage-light px-3 py-1 text-xs font-semibold tracking-wide text-sage-dark">
              <Package className="size-3" aria-hidden="true" />
              Od července 2026
            </span>
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Nakupuj lokálně.
            <br />
            <span className="text-primary">Bez cel, bez překvapení.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            EU zavádí nová cla na zásilky ze zahraničí. Oblečení z&nbsp;Číny
            zdraží o&nbsp;15–50&nbsp;%.{" "}
            <strong className="text-foreground">
              U&nbsp;nás se nic nemění&nbsp;— jsme tu doma.
            </strong>
          </p>
        </div>
      </section>

      {/* What's changing */}
      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-6 sm:p-8">
          <h2 className="font-heading text-lg font-semibold text-foreground sm:text-xl">
            Co se mění od 1.&nbsp;července 2026?
          </h2>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <p>
              Evropská unie ruší celní výjimku pro zásilky do 150&nbsp;€. Dosud
              jsi za oblečení z&nbsp;Aliexpressu, Sheinu nebo Temu platila jen
              DPH. Od července přibude{" "}
              <strong className="text-foreground">
                clo minimálně 3&nbsp;€ (cca 75&nbsp;Kč) za každou kategorii
                zboží
              </strong>{" "}
              v&nbsp;zásilce.
            </p>
            <p>
              Pro běžné oblečení to znamená zdražení o&nbsp;15–50&nbsp;%.
              A&nbsp;to nepočítáme delší doručení kvůli celnímu řízení.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-center font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Zahraničí vs. Janička
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {comparisonItems.map((item) => (
            <div
              key={item.topic}
              className="rounded-2xl border border-border/50 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                  <item.icon className="size-5 text-primary" />
                </div>
                <h3 className="font-heading text-lg font-semibold text-foreground">
                  {item.topic}
                </h3>
              </div>

              {/* Abroad */}
              <div className="mb-5">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-red-500">
                  Ze zahraničí
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.abroad}
                </p>
              </div>

              {/* Janička */}
              <div className="rounded-xl bg-sage-light p-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-sage-dark">
                  U nás
                </p>
                <p className="text-sm font-medium leading-relaxed text-charcoal">
                  {item.janicka}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t bg-muted/20">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <h2 className="mb-10 text-center font-heading text-2xl font-bold text-foreground sm:text-3xl">
            Proč nakupovat lokálně?
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title} className="text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                  <b.icon className="size-6 text-primary" />
                </div>
                <h3 className="font-heading text-base font-semibold text-foreground">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {b.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick math */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <h2 className="mb-8 text-center font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Jednoduchá matematika
        </h2>
        <div className="overflow-hidden rounded-2xl border border-border/50 shadow-sm">
          <table className="w-full text-sm sm:text-base">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground sm:px-6">
                  &nbsp;
                </th>
                <th className="px-4 py-3 text-center font-medium text-red-500 sm:px-6">
                  Shein / Temu
                </th>
                <th className="px-4 py-3 text-center font-medium text-sage-dark sm:px-6">
                  Janička
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-4 py-3 font-medium text-foreground sm:px-6">
                  Šaty
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground sm:px-6">
                  400 Kč
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground sm:px-6">
                  350 Kč
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 font-medium text-foreground sm:px-6">
                  Clo (od 7/2026)
                </td>
                <td className="px-4 py-3 text-center text-red-500 sm:px-6">
                  +75 Kč
                </td>
                <td className="px-4 py-3 text-center text-sage-dark sm:px-6">
                  0 Kč
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 font-medium text-foreground sm:px-6">
                  Poštovné
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground sm:px-6">
                  0–80 Kč
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground sm:px-6">
                  69 Kč
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 font-medium text-foreground sm:px-6">
                  Doručení
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground sm:px-6">
                  2–6 týdnů
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground sm:px-6">
                  2–3 dny
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-4 py-3 font-medium text-foreground sm:px-6">
                  Kvalita ověřena
                </td>
                <td className="px-4 py-3 text-center sm:px-6">
                  <span className="text-red-400">✕</span>
                </td>
                <td className="px-4 py-3 text-center sm:px-6">
                  <span className="text-sage-dark">✓</span>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-semibold text-foreground sm:px-6">
                  Celkem
                </td>
                <td className="px-4 py-3 text-center font-semibold text-red-600 sm:px-6">
                  475–555 Kč
                </td>
                <td className="px-4 py-3 text-center font-semibold text-sage-dark sm:px-6">
                  350–419 Kč
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          * Příklad orientační. Clo €3 přepočteno kurzem ~25 Kč/€. Skutečná
          výše se může lišit podle kategorie zboží.
        </p>
      </section>

      {/* Trust commitment */}
      <section className="border-t bg-muted/20">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="text-center">
            <MapPin className="mx-auto mb-4 size-8 text-primary/60" />
            <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
              My jsme tu doma
            </h2>
          </div>
          <div className="mt-8 space-y-5 text-center text-base leading-relaxed text-muted-foreground sm:text-lg">
            <p>
              Jsme malý český eshop s&nbsp;second hand oblečením. Každý kousek
              pečlivě vybíráme, kontrolujeme a&nbsp;fotíme. Žádné sklady
              v&nbsp;Číně, žádné překvapení na celnici.
            </p>
            <p>
              <strong className="text-foreground">
                Nakupuj lokálně — ušetříš, dostaneš kvalitu a&nbsp;podpoříš
                udržitelnou módu.
              </strong>
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Prohlédni si naši nabídku
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Každý kousek je unikát — ověřená kvalita, férová cena, doručení do
          3&nbsp;dnů.
        </p>
        <Link
          href="/products"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Prohlédnout nabídku
          <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
