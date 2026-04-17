import {
  Sparkles,
  Droplet,
  Layers,
  Scissors,
  Sun,
  Circle,
  CircleDashed,
  Wrench,
  GitMerge,
  Palette,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DEFECT_LABELS, type DefectType, type ProductDefect } from "@/lib/defects";

const DEFECT_ICONS: Record<DefectType, LucideIcon> = {
  stain: Droplet,
  pilling: Layers,
  scuff: Scissors,
  faded: Sun,
  small_hole: Circle,
  missing_button: CircleDashed,
  damaged_zipper: Wrench,
  loose_seam: GitMerge,
  yellowing: Palette,
  other: HelpCircle,
};

interface ProductDefectsProps {
  defects: ProductDefect[];
}

export function ProductDefects({ defects }: ProductDefectsProps) {
  if (defects.length === 0) {
    return (
      <div className="my-8 rounded-2xl border border-sage-light bg-sage-light/30 p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-dark/10">
            <Sparkles className="size-5 text-sage-dark" />
          </div>
          <div>
            <p className="font-heading text-base font-semibold text-foreground">
              Bez viditelných vad
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Kousek je v perfektním stavu — nic jsme neobjevili.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label="Nedokonalosti produktu"
      className="my-8 rounded-2xl border border-border bg-background p-6"
    >
      <div className="mb-4">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Na co upozorňujeme
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Každý second-hand kousek má svůj příběh. Tady je ten jeho — ať víš přesně, co kupuješ.
        </p>
      </div>

      <ul className="space-y-3">
        {defects.map((defect, i) => {
          const Icon = DEFECT_ICONS[defect.type] ?? HelpCircle;
          return (
            <li
              key={i}
              className="flex gap-3 rounded-xl bg-muted/40 p-3.5"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {DEFECT_LABELS[defect.type]}
                </p>
                {defect.description && (
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {defect.description}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
