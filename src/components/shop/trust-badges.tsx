import { ShieldCheck, Truck, RotateCcw, Camera, Sparkles } from "lucide-react";

const badges = [
  {
    icon: ShieldCheck,
    title: "Ověřená kvalita",
    description: "Každý kousek pečlivě kontrolujeme a fotografujeme",
  },
  {
    icon: Truck,
    title: "Rychlé doručení",
    description: "Odesíláme do 1–2 pracovních dnů po celé ČR",
  },
  {
    icon: RotateCcw,
    title: "14 dní na vrácení",
    description: "Nesedí? Vrátíme peníze bez otázek",
  },
  {
    icon: Camera,
    title: "Reálné foto — žádné AI",
    description: "Každý kousek fotografujeme my — přesně to, co dostaneš",
  },
  {
    icon: Sparkles,
    title: "Unikátní kousky",
    description: "Každý kus je originál — značková móda za zlomek ceny",
  },
];

export function TrustBadges() {
  return (
    <section className="border-y border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-6 sm:gap-8 lg:grid-cols-5">
          {badges.map((badge) => (
            <div key={badge.title} className="text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-light/20 to-brand/10 text-primary ring-1 ring-primary/10 sm:size-12">
                <badge.icon className="size-5 sm:size-6" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {badge.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {badge.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
