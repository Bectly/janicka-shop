import type { Metadata } from "next";
import Link from "next/link";
import { Camera, Eye, Lock, Heart, ArrowRight, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Tvoje fotky jsou tvoje | Janička",
  description:
    "U Janičky tvoje fotky nikdy nepoužijeme k trénování AI. Žádné skryté klauzule, žádné překvapení. Tvoje soukromí je pro nás svaté.",
  openGraph: {
    title: "Tvoje fotky jsou tvoje. Vždy.",
    description:
      "Zatímco jiné platformy trénují AI na tvých fotkách, u Janičky je to jinak. A vždy bylo.",
    type: "website",
    locale: "cs_CZ",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tvoje fotky jsou tvoje. Vždy.",
    description:
      "Zatímco jiné platformy trénují AI na tvých fotkách, u Janičky je to jinak. A vždy bylo.",
  },
};

const comparisonItems = [
  {
    topic: "Trénování AI",
    icon: Camera,
    vinted:
      "Od 30. dubna automaticky získávají právo používat tvoje fotky a inzeráty k trénování AI modelů — bez možnosti odmítnutí.",
    janicka:
      "Tvoje fotky nikdy nepoužijeme k trénování AI. Ani dnes, ani zítra, ani za rok. Tečka.",
  },
  {
    topic: "Vlastnictví dat",
    icon: Lock,
    vinted:
      "Nové podmínky udělují \"celosvětovou, bezúplatnou, trvalou licenci\" na veškerý tvůj obsah — fotky, popisy, vše.",
    janicka:
      "Tvoje data patří tobě. Zpracováváme jen to, co potřebujeme k doručení objednávky. Nic navíc.",
  },
  {
    topic: "Transparentnost",
    icon: Eye,
    vinted:
      "Opt-out v nastavení pokrývá jen marketing. Trénování AI nelze odmítnout — je schované hluboko v podmínkách.",
    janicka:
      "Naše podmínky jsou psané česky, srozumitelně a bez skrytých klauzulí. Když se něco změní, řekneme to rovnou.",
  },
];

export default function SoukromiPage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-white" />
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pb-20 sm:pt-28 lg:px-8">
          {/* Editorial pill-badge */}
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
              <Shield className="size-3" aria-hidden="true" />
              Soukromí & důvěra
            </span>
          </div>
          <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Tvoje fotky jsou tvoje.
            <br />
            <span className="text-primary">Vždy.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Zatímco jiné platformy mění podmínky a&nbsp;trénují AI na tvých
            fotkách, u&nbsp;nás je to jinak.{" "}
            <strong className="text-foreground">A&nbsp;vždy bylo.</strong>
          </p>
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <h2 className="sr-only">Srovnání přístupu k soukromí</h2>
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

              {/* Vinted */}
              <div className="mb-5">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-red-500">
                  Jinde
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.vinted}
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

      {/* Commitment */}
      <section className="border-t bg-muted/20">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="text-center">
            <Heart className="mx-auto mb-4 size-8 text-primary/60" />
            <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
              Náš slib
            </h2>
          </div>
          <div className="mt-8 space-y-5 text-left text-base leading-relaxed text-muted-foreground sm:text-center sm:text-lg">
            <p>
              Jsme malý český eshop s&nbsp;oblečením. Nejsme korporace
              s&nbsp;tisíci zaměstnanců a&nbsp;právníky, co píšou podmínky tak,
              aby jim nikdo nerozuměl.
            </p>
            <p>
              Prodáváme oblečení — a&nbsp;to je všechno, co děláme.{" "}
              <strong className="text-foreground">
                Netrénujeme AI, neprodáváme data, neschováváme se za
                &bdquo;oprávněný zájem&ldquo;.
              </strong>
            </p>
            <p>
              Každý kousek, který u&nbsp;nás vidíš, jsme osobně zkontrolovaly
              a&nbsp;vyfotily. Reálné fotky, reálný stav, žádné překvapení.
              Protože důvěra se nebuduje podmínkami — buduje se činy.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <h2 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Nakupuj s&nbsp;klidem
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          Prohlédni si naši nabídku — každý kousek je unikát a&nbsp;čeká jen na
          tebe.
        </p>
        <Link
          href="/products"
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:w-auto"
        >
          Prohlédnout nabídku
          <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
