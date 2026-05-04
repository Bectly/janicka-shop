import Image from "next/image";

interface EditorialPullQuoteProps {
  portraitUrl?: string | null;
}

export function EditorialPullQuote({ portraitUrl }: EditorialPullQuoteProps) {
  return (
    <section
      aria-label="Janička — citace"
      className="bg-card"
    >
      <div className="mx-auto max-w-5xl px-4 py-section sm:px-6 lg:px-8">
        <div className="grid items-center gap-stack lg:grid-cols-12 lg:gap-stack-lg">
          {/* LEFT: arch-framed portrait */}
          <div className="relative mx-auto w-full max-w-xs lg:col-span-4 lg:max-w-none">
            <div className="relative aspect-[4/5]">
              {portraitUrl ? (
                <Image
                  src={portraitUrl}
                  alt="Janička při výběru kousků"
                  fill
                  sizes="(max-width: 1024px) 60vw, 240px"
                  className="rounded-card object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-card bg-gradient-to-br from-blush via-card to-champagne-light/60">
                  <Image
                    src="/logo/logo-transparent.png"
                    alt=""
                    width={320}
                    height={174}
                    className="h-auto w-2/3 opacity-70"
                  />
                </div>
              )}
              {/* Arch decorative frame overlay */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 text-brand/40"
              >
                <Image
                  src="/decor/arch.svg"
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 60vw, 240px"
                  className="object-contain"
                />
              </div>
            </div>
          </div>

          {/* RIGHT: italic serif pull-quote */}
          <blockquote className="border-l-4 border-brand/40 pl-stack lg:col-span-8">
            <p className="font-heading italic text-2xl leading-snug text-charcoal sm:text-3xl lg:text-4xl">
              „Každý kus má svůj příběh.
              <span className="block text-brand">Já vybírám, ty nosíš dál."</span>
            </p>
            <footer className="mt-stack-sm flex items-center gap-stack-xs text-xs tracking-[0.25em] text-brand/70 uppercase">
              <Image
                src="/decor/sparkle.svg"
                alt=""
                aria-hidden="true"
                width={12}
                height={12}
                className="size-3"
              />
              <span>Janička</span>
              <Image
                src="/decor/sparkle.svg"
                alt=""
                aria-hidden="true"
                width={12}
                height={12}
                className="size-3"
              />
            </footer>
          </blockquote>
        </div>
      </div>
    </section>
  );
}
