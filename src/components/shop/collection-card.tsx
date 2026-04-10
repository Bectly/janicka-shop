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
      className={`group relative overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${wide ? "sm:col-span-2" : ""}`}
    >
      {/* ── Image / empty state ────────────────────────────── */}
      <div className="relative aspect-[4/3] overflow-hidden">
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
            />
            {/* Editorial gradient — ensures text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
            {/* Subtle brand-tint on hover */}
            <div className="absolute inset-0 bg-primary/0 transition-colors duration-300 group-hover:bg-primary/8" />
          </>
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${gradientTheme} transition-opacity duration-300 group-hover:opacity-90`}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-2xl bg-white/30 p-4 shadow-sm backdrop-blur-sm">
                <Layers className="size-8 text-brand-dark/50" />
              </div>
            </div>
          </div>
        )}

        {/* ── Overlaid content ─────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
          {/* Count pill */}
          {countLabel && (
            <div className="mb-2 inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 backdrop-blur-sm">
              <span className={`text-[11px] font-medium ${hasImage ? "text-white/90" : "text-brand-dark/80"}`}>
                {countLabel}
              </span>
            </div>
          )}

          {/* Title */}
          <h2
            className={`font-heading font-bold tracking-tight transition-colors duration-200 ${
              wide ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"
            } ${hasImage ? "text-white" : "text-brand-dark"}`}
          >
            {title}
          </h2>

          {/* Description */}
          {description && (
            <p
              className={`mt-1 line-clamp-2 text-sm leading-snug ${
                hasImage ? "text-white/75" : "text-brand-dark/65"
              }`}
            >
              {description}
            </p>
          )}

          {/* CTA arrow */}
          <p
            className={`mt-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-all duration-300 group-hover:gap-2 ${
              hasImage ? "text-white/80" : "text-brand"
            }`}
          >
            Prohlédnout
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
