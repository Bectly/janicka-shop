import type { Metadata } from "next";
import Image from "next/image";
import { Heart, Sparkles, Hand } from "lucide-react";
import { getSiteSetting, HERO_EDITORIAL_IMAGE_KEY } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "O nás | Janička",
  description:
    "Janička — česká rodinná second hand značka. Každý kousek osobně vybraný a nafocený. Žádný sklad, žádný algoritmus — jen pečlivý výběr a jeden originál.",
};

const values = [
  {
    icon: Hand,
    title: "Vybírám osobně",
    body: "Každý kousek prochází mýma rukama. Nafotím ho, zkontroluji stav, popíšu každý detail.",
    gradient: "from-brand/[0.06] to-champagne-light/30",
    iconGradient: "from-brand/20 to-blush",
  },
  {
    icon: Sparkles,
    title: "Jeden kus, jedna šance",
    body: "Každý kousek je u nás jen jednou. Když padne do oka, neváhejte — zítra už tu nemusí být.",
    gradient: "from-blush-light/40 to-brand/[0.04]",
    iconGradient: "from-blush to-brand/20",
  },
  {
    icon: Heart,
    title: "Česká a blízká",
    body: "Malý rodinný second hand z Česka. Napíšete a odpovídá vám člověk — ne chatbot.",
    gradient: "from-sage-light/30 to-champagne-light/20",
    iconGradient: "from-sage-light/60 to-champagne-light/40",
  },
] as const;

export default async function AboutPage() {
  const editorialImageUrl = await getSiteSetting(HERO_EDITORIAL_IMAGE_KEY);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pb-20 lg:px-8">
      {/* Editorial hero — image when uploaded, otherwise blush-gradient monogram */}
      <section className="relative mb-10 overflow-hidden rounded-3xl shadow-2xl">
        <div className="relative aspect-[4/5] w-full sm:aspect-[16/10] lg:aspect-[2/1]">
          {editorialImageUrl ? (
            <Image
              src={editorialImageUrl}
              alt="Janička — editoriální foto"
              fill
              priority
              fetchPriority="high"
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand/15 via-blush-light/60 to-champagne-light">
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center font-heading text-[clamp(8rem,28vw,16rem)] font-bold leading-none text-brand-dark/85 drop-shadow-sm"
                style={{ fontStyle: "italic" }}
              >
                J
              </span>
            </div>
          )}

          {/* Soft warm wash so text on the photo always reads */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/20 to-transparent"
          />

          {/* Hero copy */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-5 sm:p-8 lg:p-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-eyebrow text-charcoal backdrop-blur">
              <Heart className="size-3 text-brand" aria-hidden="true" />
              Náš příběh
            </span>
            <h1 className="font-heading text-[clamp(2rem,5vw+1rem,3.5rem)] font-bold leading-[1.05] text-white drop-shadow-md">
              O nás
            </h1>
          </div>
        </div>
      </section>

      {/* Pull-quote — italic serif, atmospheric */}
      <blockquote className="mx-auto mb-10 max-w-2xl border-l-2 border-brand pl-5 sm:mb-12">
        <p className="text-tagline-italic text-[clamp(1.125rem,1vw+1rem,1.375rem)] leading-relaxed">
          „Jeden pár rukou, který každý den vybírá, kontroluje a fotí kousky,
          co si zaslouží druhou šanci."
        </p>
        <footer className="mt-2 text-eyebrow">— Janička</footer>
      </blockquote>

      {/* Tight intro */}
      <p className="mx-auto mb-10 max-w-2xl text-muted-foreground leading-relaxed sm:text-lg">
        Vítejte v <strong className="text-foreground">Janičce</strong> — malém
        českém second handu vedeném z&nbsp;lásky k&nbsp;oblečení, které má
        ještě co&nbsp;říct. Menší výběr, ale&nbsp;každý kus osobně prohlédnutý,
        přesně popsaný a&nbsp;nafocený. Žádný sklad, žádný algoritmus, žádná
        překvapení po&nbsp;rozbalení.
      </p>

      {/* Values grid */}
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        {values.map(({ icon: Icon, title, body, gradient, iconGradient }) => (
          <div
            key={title}
            className={`flex flex-col gap-3 rounded-xl border border-border/60 bg-gradient-to-br ${gradient} p-4`}
          >
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${iconGradient} ring-1 ring-inset ring-black/[0.06]`}
            >
              <Icon className="size-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* What you'll find */}
      <section className="mx-auto max-w-2xl text-muted-foreground">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Co u nás najdete
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-1">
          <li>Šaty pro každou příležitost</li>
          <li>Topy a halenky od známých značek</li>
          <li>Kalhoty a sukně v perfektním stavu</li>
          <li>Bundy a kabáty na každé počasí</li>
          <li>Doplňky — šperky, kabelky, šátky</li>
        </ul>
        <p className="mt-6 text-sm">
          Děkujeme, že nakupujete právě u&nbsp;nás — podporujete tím malý český
          obchod a&nbsp;zároveň udržitelnou módu.{" "}
          <Heart
            className="inline-block size-4 align-text-bottom text-brand"
            aria-hidden="true"
          />
        </p>
      </section>
    </div>
  );
}
