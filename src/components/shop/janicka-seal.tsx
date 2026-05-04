import { cn } from "@/lib/utils";

interface JanickaSealProps {
  variant?: "default" | "compact";
  tone?: "default" | "onDark";
  photoUrl?: string | null;
  className?: string;
}

/**
 * "Vybrala a nafotila Janička osobně" — personal authenticity seal.
 *
 * Renders the "J" initial badge by default. Pass `photoUrl` (e.g. from a
 * SiteSetting) to swap in a real photo — only do that when the URL is known
 * to resolve, since a missing asset would render the browser's broken-image
 * icon before client JS can fall back.
 */
export function JanickaSeal({
  variant = "default",
  tone = "default",
  photoUrl = null,
  className,
}: JanickaSealProps) {
  const sizePx = variant === "compact" ? 20 : 24;
  const textCls = variant === "compact" ? "text-[11px]" : "text-sm";
  const onDark = tone === "onDark";

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-l-2 pl-2.5",
        textCls,
        onDark
          ? "border-white/70 text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]"
          : "border-brand text-muted-foreground",
        className,
      )}
      aria-label="Vybrala a nafotila Janička osobně"
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          width={sizePx}
          height={sizePx}
          className={cn(
            "rounded-full object-cover",
            onDark && "ring-1 ring-white/40",
          )}
          style={{ width: sizePx, height: sizePx }}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full font-semibold",
            onDark
              ? "bg-white/20 text-white ring-1 ring-white/40 [text-shadow:none]"
              : "bg-brand/15 text-brand-dark",
          )}
          style={{
            width: sizePx,
            height: sizePx,
            fontSize: variant === "compact" ? 10 : 12,
          }}
        >
          J
        </span>
      )}
      <span className="leading-tight">Vybrala a nafotila Janička osobně</span>
    </div>
  );
}
