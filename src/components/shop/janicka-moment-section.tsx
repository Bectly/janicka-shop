import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JanickaMomentSection({
  editorialImageUrl,
}: {
  editorialImageUrl?: string | null;
}) {
  const hasEditorial = Boolean(editorialImageUrl);

  return (
    <section
      aria-labelledby="janicka-moment-heading"
      className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
    >
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
        {/* Editorial photo / branded fallback */}
        <div className="lg:col-span-5">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-brand-light/30 via-blush to-champagne-light/40 shadow-xl ring-1 ring-inset ring-black/[0.04]">
            {hasEditorial ? (
              <Image
                src={editorialImageUrl as string}
                alt="Janička při výběru kousků"
                fill
                sizes="(max-width: 1024px) 90vw, 480px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
                <Image
                  src="/logo/logo-transparent.png"
                  alt="Janička"
                  width={320}
                  height={174}
                  className="h-auto w-[180px] drop-shadow-md sm:w-[220px]"
                />
                <p className="font-heading italic text-base text-charcoal/80 sm:text-lg">
                  Foto Janičky brzy doplníme.
                </p>
              </div>
            )}

            {/* Soft brand glow accent */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-6 -top-6 size-24 rounded-full bg-brand/20 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-6 -right-6 size-32 rounded-full bg-champagne/40 blur-3xl"
            />
          </div>
        </div>

        {/* Story + CTA */}
        <div className="lg:col-span-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/[0.06] px-3 py-1 text-xs font-semibold tracking-wider text-brand uppercase">
            <Quote className="size-3" aria-hidden="true" />
            Janičin příběh
          </span>

          <h2
            id="janicka-moment-heading"
            className="mt-4 font-heading text-[1.75rem] font-bold leading-tight text-foreground sm:text-[2.25rem] lg:text-[2.5rem]"
          >
            Žádný sklad. Žádný algoritmus.
            <span className="block text-brand">Jen pár rukou a oko pro krásu.</span>
          </h2>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-charcoal-light sm:text-lg">
            Každý kus, který tu vidíš, prošel mýma rukama. Vybírám podle stavu,
            střihu a duše. Fotím doma, balím sama, posílám s ručně psanou
            kartičkou. Není to obchod — je to malá přehlídka kousků, které mi
            dávají smysl.
          </p>

          <p className="mt-3 max-w-xl text-sm leading-relaxed text-charcoal-light/80">
            Jeden kus, jedna velikost. Když ho někdo koupí, zmizí — a tak to má
            být.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              data-track="janicka-moment-cta"
              render={<Link href="/about" />}
            >
              Více o Janičce
              <ArrowRight data-icon="inline-end" className="size-4" />
            </Button>
            <Link
              href="/products?sort=newest"
              data-track="janicka-moment-secondary"
              className="inline-flex min-h-[44px] items-center gap-1 px-2 text-sm font-medium text-primary hover:underline"
            >
              Podívat se na novinky →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
