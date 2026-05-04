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
      className={`group relative overflow-hidden rounded-2xl shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_16px_40px_-8px_rgba(180,130,140,0.20)] haptic-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 ${wide ? "sm:col-span-2" : ""}`}
    >
      {/* ── Image / empty state ────────────────────────────── */}
      <div className={`relative overflow-hidden ${wide ? "aspect-[4/3] sm:aspect-[3/2]" : "aspect-[4/3] sm:aspect-[3/2] lg:aspect-[4/3]"}`}>
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
              className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
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
            {/* Decorative initial — editorial signal of curated emptiness */}
            <div
              className="pointer-events-none absolute -right-4 -top-6 select-none font-heading text-[8rem] font-bold leading-none text-brand-dark/[0.08] sm:text-[10rem]"
              aria-hidden="true"
            >
              {title.charAt(0)}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-white/40 p-3 shadow-sm backdrop-blur-sm ring-1 ring-white/30">
                <Layers className="size-6 text-brand-dark/60" />
              </div>
            </div>
            {/* Soft bottom fade so overlaid title sits cleanly */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/45 via-white/10 to-transparent" />
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
            className={`font-heading font-bold tracking-tight transition-colors duration-200 ${
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
