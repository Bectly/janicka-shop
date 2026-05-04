import { Camera, Heart, Sparkles } from "lucide-react";

const beats = [
  { icon: Camera, label: "Vybírám sama" },
  { icon: Sparkles, label: "Fotím sama" },
  { icon: Heart, label: "Balím s láskou" },
];

export function EditorialStoryStrip() {
  return (
    <section
      aria-label="Janička — brand statement"
      className="border-y border-border/40 bg-gradient-to-r from-blush-light via-card to-blush-light"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 py-10 text-center sm:px-6 sm:py-12 lg:px-8">
        <p className="font-heading italic text-xl leading-relaxed text-charcoal sm:text-2xl lg:text-3xl">
          Každý kus jedna šance.
          <span className="block text-brand">
            Vybírám sama, fotím sama, balím s láskou.
          </span>
        </p>

        <div
          aria-hidden="true"
          className="flex items-center gap-3 text-brand/40"
        >
          <span className="h-px w-10 bg-brand/20" />
          <span className="text-xs uppercase tracking-[0.2em]">Janička</span>
          <span className="h-px w-10 bg-brand/20" />
        </div>

        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-charcoal-light/80">
          {beats.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-1.5">
              <Icon className="size-4 text-brand/70" aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
