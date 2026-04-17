import Link from "next/link";
import { ShieldCheck, Truck, RotateCcw, Sparkles, Star } from "lucide-react";

const badges: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  cardBg: string;
  iconBg: string;
  border: string;
  href?: string;
}[] = [
  {
    icon: ShieldCheck,
    title: "Ověřená kvalita",
    description: "Každý kousek pečlivě kontrolujeme a fotografujeme",
    cardBg: "from-sage-light/20 to-sage/[0.06]",
    iconBg: "from-sage-light/50 to-sage/20",
    border: "border-sage/20",
  },
  {
    icon: Truck,
    title: "Rychlé doručení",
    description: "Odesíláme do 1–2 pracovních dnů po celé ČR",
    cardBg: "from-champagne/25 to-champagne-light/[0.08]",
    iconBg: "from-champagne/55 to-champagne-dark/15",
    border: "border-champagne-dark/20",
  },
  {
    icon: RotateCcw,
    title: "14 dní na vrácení",
    description: "Nesedí? Vrátíme peníze bez otázek",
    cardBg: "from-brand-light/15 to-brand/[0.04]",
    iconBg: "from-brand-light/35 to-brand/15",
    border: "border-brand/15",
  },
  {
    icon: Sparkles,
    title: "Unikátní kousky",
    description: "Každý kus je originál — značková móda za zlomek ceny",
    cardBg: "from-champagne-light/35 to-champagne/[0.06]",
    iconBg: "from-champagne-light/65 to-champagne/25",
    border: "border-champagne/25",
  },
];

export function TrustBadges() {
  return (
    <section className="border-y border-border/60 bg-gradient-to-br from-brand/[0.02] via-background to-champagne/[0.03]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        {/* Section header */}
        <div className="mb-10 text-center sm:mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
            <Star className="size-3 fill-current" />
            Naše sliby
          </span>
          <h2 className="mt-3 font-heading text-[1.5rem] font-bold text-foreground sm:text-[1.75rem]">
            Proč nakupovat u nás
          </h2>
        </div>

        {/* Badges grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
          {badges.map((badge) => {
            const inner = (
              <>
                <div
                  className={`flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br ${badge.iconBg} text-primary ring-1 ring-inset ring-black/[0.06]`}
                >
                  <badge.icon className="size-6" />
                </div>
                <h3 className="mt-3.5 text-sm font-semibold leading-snug text-foreground">
                  {badge.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {badge.description}
                </p>
                {badge.href && (
                  <span className="mt-2 text-[11px] font-semibold text-primary/70">
                    Přečti si víc →
                  </span>
                )}
              </>
            );

            const sharedClass = `flex flex-col items-center rounded-2xl border ${badge.border} bg-gradient-to-br ${badge.cardBg} p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-sm`;

            return badge.href ? (
              <Link key={badge.title} href={badge.href} className={sharedClass}>
                {inner}
              </Link>
            ) : (
              <div key={badge.title} className={sharedClass}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
