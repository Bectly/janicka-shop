import type { Metadata } from "next";
import { Heart, Sparkles, Hand } from "lucide-react";

export const metadata: Metadata = {
  title: "O nás | Janička",
  description:
    "Janička — česká rodinná second hand značka. Každý kousek osobně vybraný a nafocený. Žádný sklad, žádný algoritmus — jen pečlivý výběr a jeden originál.",
};

const values = [
  {
    icon: Hand,
    title: "Vybírám osobně",
    body: "Každý kousek prochází mýma rukama. Nafotím ho, zkontroluji stav, popíšu každý detail. Žádný sklad, žádný algoritmus — jen pečlivý ruční výběr.",
    gradient: "from-brand/[0.06] to-champagne-light/30",
    iconGradient: "from-brand/20 to-blush",
  },
  {
    icon: Sparkles,
    title: "Jeden kus, jedna šance",
    body: "Každý kousek je u nás jen jednou. Když padne do oka, neváhejte — zítra už tu nemusí být. Žádné duplikáty, žádné hromadné kolekce.",
    gradient: "from-blush-light/40 to-brand/[0.04]",
    iconGradient: "from-blush to-brand/20",
  },
  {
    icon: Heart,
    title: "Česká a blízká",
    body: "Malý rodinný second hand z Česka, ne korporace. Napíšete a odpovídá vám člověk — ne chatbot. Na balíčcích poznáte, že je baleno s péčí.",
    gradient: "from-sage-light/30 to-champagne-light/20",
    iconGradient: "from-sage-light/60 to-champagne-light/40",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Editorial header */}
      <div className="mb-10 flex flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
          <Heart className="size-3" />
          Náš příběh
        </span>
        <h1 className="font-heading text-[1.75rem] font-bold text-foreground sm:text-3xl">
          O nás
        </h1>
        <p className="text-muted-foreground">
          Janička — česká rodinná second hand značka. Jeden pár rukou, který
          vybírá, kontroluje a fotí každý kousek osobně.
        </p>
      </div>

      <div className="space-y-8 text-muted-foreground leading-relaxed">
        <p>
          Vítejte v <strong className="text-foreground">Janičce</strong> —
          malém českém second handu vedeném z&nbsp;lásky k&nbsp;oblečení, které
          má&nbsp;ještě co&nbsp;říct. Nejsme sklad. Nejsme algoritmus. Jsme
          jeden pár rukou, který každý den vybírá, kontroluje a&nbsp;fotí
          kousky, co&nbsp;si&nbsp;zaslouží druhou šanci.
        </p>

        <p>
          Na&nbsp;velkých platformách se&nbsp;ztratíte mezi desítkami tisíc
          nabídek od&nbsp;cizích prodejců. U&nbsp;nás je&nbsp;to&nbsp;naopak —
          menší výběr, ale&nbsp;každý kus osobně prohlédnutý, přesně
          popsaný a&nbsp;nafocený tak, aby&nbsp;přesně seděl popis. Žádná
          překvapení po&nbsp;rozbalení.
        </p>

        {/* Values grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          {values.map(({ icon: Icon, title, body, gradient, iconGradient }) => (
            <div
              key={title}
              className={`flex flex-col gap-3 rounded-xl border border-border/60 bg-gradient-to-br ${gradient} p-4`}
            >
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${iconGradient} ring-1 ring-inset ring-black/[0.06]`}
              >
                <Icon className="size-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                <p className="mt-1 text-sm">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <section>
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
          <p className="mt-3 text-sm">
            A&nbsp;jeden důležitý detail: každý kus je u&nbsp;nás jen jednou.
            Žádné hromadné dodávky, žádná druhá stejná velikost. Unikát v&nbsp;tom
            pravém slova smyslu.
          </p>
        </section>

        <p>
          Děkujeme, že nakupujete právě u&nbsp;nás — podporujete tím malý český
          obchod a&nbsp;zároveň udržitelnou módu.{" "}
          <Heart className="inline-block size-4 align-text-bottom text-brand" aria-hidden="true" />
        </p>
      </div>
    </div>
  );
}
