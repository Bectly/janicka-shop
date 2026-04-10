import type { Metadata } from "next";
import { Leaf, ShieldCheck, Star } from "lucide-react";

export const metadata: Metadata = {
  title: "O nás | Janička",
  description:
    "Janička — second hand eshop s kvalitním oblečením pro moderní ženy. Udržitelná móda, unikátní kousky, skvělé ceny.",
};

const values = [
  {
    icon: Leaf,
    title: "Udržitelná móda",
    body: "Každý kousek, který si od nás koupíš, dostává druhý život. Méně odpadu, méně fast fashion — víc stylu s vědomím, že to dělá smysl.",
    gradient: "from-sage-light/30 to-champagne-light/20",
    iconGradient: "from-sage-light/60 to-champagne-light/40",
  },
  {
    icon: ShieldCheck,
    title: "Pečlivý výběr",
    body: "Každý kousek osobně kontrolujeme. Uvádíme přesný stav, značku i velikost — abyste přesně věděly, co kupujete. Žádné překvapení.",
    gradient: "from-brand/[0.06] to-champagne-light/30",
    iconGradient: "from-brand/20 to-blush",
  },
  {
    icon: Star,
    title: "Unikátní kousky",
    body: "Vybíráme jen prémiové značky v skvělém stavu. Nenajdete u nás hromadné kolekce — každý kousek je originál.",
    gradient: "from-blush-light/40 to-brand/[0.04]",
    iconGradient: "from-blush to-brand/20",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Editorial header */}
      <div className="mb-10 flex flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
          <Leaf className="size-3" />
          Náš příběh
        </span>
        <h1 className="font-heading text-[1.75rem] font-bold text-foreground sm:text-3xl">
          O nás
        </h1>
        <p className="text-muted-foreground">
          Janička — kurátorský second hand pro moderní ženy. Kvalita, styl a
          udržitelnost v každém kousku.
        </p>
      </div>

      <div className="space-y-8 text-muted-foreground leading-relaxed">
        <p>
          Vítejte v <strong className="text-foreground">Janičce</strong> —
          vašem oblíbeném second hand obchodu s oblečením. Věříme, že krásné
          oblečení nemusí být drahé a že udržitelná móda je budoucnost.
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
        </section>

        <p>
          Děkujeme, že nakupujete u nás a podporujete udržitelnou módu. 💚
        </p>
      </div>
    </div>
  );
}
