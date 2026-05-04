import Link from "next/link";
import Image from "next/image";
import { Layers } from "lucide-react";

// Brand-palette gradient themes for empty state (no image) cards
const EMPTY_THEMES = [
  "from-brand/15 via-blush-dark/25 to-champagne/35",
  "from-sage-light/50 via-champagne-light/30 to-brand-light/20",
  "from-champagne/40 via-blush/20 to-sage-light/40",
  "from-blush-dark/30 via-brand/8 to-champagne-light/50",
] as const;

interface CollectionCardProps {
  slug: string;
  title: string;
  description?: string | null;
  image?: string | null;
  availableCount?: number;
  priority?: boolean;
  index?: number;
  /** When true the card spans 2 grid columns — use for hero/first card */
  wide?: boolean;
}

export function CollectionCard({
  slug,
  title,
  description,
  image,
  availableCount,
  priority,
  index = 0,
  wide,
}: CollectionCardProps) {
  const countLabel =
    availableCount == null
      ? null
      : availableCount === 1
        ? "1 kousek"
        : availableCount >= 2 && availableCount <= 4
          ? `${availableCount} kousky`
          : `${availableCount} kousků`;

  const gradientTheme = EMPTY_THEMES[index % EMPTY_THEMES.length];
  const hasImage = Boolean(image);

  return (
    <Link
      href={`/collections/${slug}`}
      className={`group relative overflow-hidden rounded-card shadow-card-rest transition-all ease-out-expo duration-slow hover:-translate-y-1 hover:shadow-card-hover haptic-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 ${wide ? "sm:col-span-2" : ""}`}
    >
      {/* ── Image / empty state ────────────────────────────── */}
      {/* Aspect ratios kept tall enough that overlaid text block ≥ ~80px even on 2-col tablet (~320px wide) */}
      <div className={`relative overflow-hidden ${wide ? "aspect-[4/3] sm:aspect-[3/2]" : "aspect-[4/3]"}`}>
        {hasImage ? (
          <>
            <Image
              src={image!}
              alt={title}
              fill
              sizes={wide
                ? "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 66vw"
                : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              }
              className="object-cover object-center transition-transform ease-out-expo duration-slow group-hover:scale-105"
              priority={priority}
              quality={90}
            />
            {/* Editorial gradient — stronger via stop ensures WCAG AA on count pill text */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-black/10" />
            {/* Subtle brand-tint on hover */}
            <div className="absolute inset-0 bg-primary/0 transition-colors duration-300 group-hover:bg-primary/8" />
          </>
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${gradientTheme} transition-opacity duration-300 group-hover:opacity-90`}
          >
            {/* Editorial monogram — title initial as dominant visual */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="pointer-events-none select-none font-heading font-bold leading-none text-brand-dark/[0.18] transition-transform duration-500 group-hover:scale-110 text-[7rem] sm:text-[8rem] lg:text-[10rem]"
                aria-hidden="true"
              >
                {title.charAt(0)}
              </div>
            </div>
            {/* Small Kolekce eyebrow — signals editorial intent over generic placeholder */}
            <div className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-pill bg-white/55 px-2 py-0.5 ring-1 ring-brand-dark/10 backdrop-blur-sm">
              <Layers className="size-3 text-brand-dark/60" aria-hidden="true" />
              <span className="text-eyebrow !text-brand-dark/70">
                Kolekce
              </span>
            </div>
            {/* Soft bottom fade so overlaid title sits cleanly */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/55 via-white/15 to-transparent" />
          </div>
        )}

        {/* ── Overlaid content ─────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-5">
          {/* Count pill — WCAG AA: solid black/45 background + white text = ≥4.5:1 */}
          {countLabel && (
            <div className={`mb-2 inline-flex items-center rounded-full px-2.5 py-0.5 backdrop-blur-sm ${
              hasImage ? "bg-black/45 ring-1 ring-white/15" : "bg-white/60 ring-1 ring-brand-dark/10"
            }`}>
              <span className={`text-[11px] font-semibold ${hasImage ? "text-white" : "text-brand-dark/85"}`}>
                {countLabel}
              </span>
            </div>
          )}

          {/* Title */}
          <h2
            className={`font-heading font-bold tracking-tight transition-colors ease-out-expo duration-soft ${
              wide ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"
            } ${hasImage ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" : "text-brand-dark"}`}
          >
            {title}
          </h2>

          {/* Description — fallback text when admin nevyplnil */}
          <p
            className={`mt-1 line-clamp-2 text-sm leading-snug ${
              hasImage ? "text-white/85 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" : "text-brand-dark/70"
            }`}
          >
            {description || (countLabel ? `Kurátorovaný výběr — ${countLabel}` : "Kurátorovaný výběr")}
          </p>

          {/* CTA arrow — subtle directional hint, no redundant text (whole card is the link) */}
          <p
            className={`mt-2.5 flex items-center gap-1 text-sm transition-all duration-300 group-hover:gap-2 ${
              hasImage ? "text-white/60" : "text-brand/60"
            }`}
            aria-hidden="true"
          >
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
