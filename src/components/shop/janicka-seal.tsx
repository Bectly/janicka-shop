"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface JanickaSealProps {
  variant?: "default" | "compact";
  tone?: "default" | "onDark";
  className?: string;
}

/**
 * "Vybrala a nafotila Janička osobně" — personal authenticity seal.
 * QW-05: differentiator vs. mass second-hand marketplaces.
 *
 * Avatar at /janicka/avatar.jpg — falls back to "J" initials badge if missing
 * (so the component never crashes when the asset hasn't been uploaded yet).
 */
export function JanickaSeal({
  variant = "default",
  tone = "default",
  className,
}: JanickaSealProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

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
      {!avatarFailed ? (
        // Plain <img> so onError fallback works without next/image build-time validation.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/janicka/avatar.jpg"
          alt=""
          width={sizePx}
          height={sizePx}
          className={cn(
            "rounded-full object-cover",
            onDark && "ring-1 ring-white/40",
          )}
          style={{ width: sizePx, height: sizePx }}
          onError={() => setAvatarFailed(true)}
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
