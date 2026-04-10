"use client";

import { useState, useEffect } from "react";
import { X, Truck, Sparkles, RotateCcw, Star, Diamond, type LucideIcon } from "lucide-react";

const STORAGE_KEY = "janicka-announcement-dismissed";

const messages: { icon: LucideIcon; text: string }[] = [
  { icon: Truck,      text: "Doprava zdarma od 1 500 Kč" },
  { icon: Sparkles,   text: "Každý kousek je unikát — second hand & vintage" },
  { icon: RotateCcw,  text: "14 dní na vrácení bez udání důvodu" },
  { icon: Star,       text: "Prémiová kvalita, ověřený stav" },
];

function MessageItem({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3 shrink-0 opacity-75" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

function MarqueeTrack() {
  return (
    <>
      {messages.map((msg, i) => (
        <span key={i} className="inline-flex items-center">
          <MessageItem icon={msg.icon} text={msg.text} />
          <Diamond className="mx-5 size-2 shrink-0 fill-white/25 text-white/25" aria-hidden="true" />
        </span>
      ))}
    </>
  );
}

export function AnnouncementBar() {
  // Fix hydration mismatch: always render on server (hidden via useEffect), not via typeof window
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      setDismissed(true);
    }
    setMounted(true);
  }, []);

  // Don't render until client-side hydration is complete
  if (!mounted || dismissed) return null;

  return (
    <div className="announcement-bar relative overflow-hidden bg-gradient-to-r from-brand via-brand-dark to-brand text-white">
      <div className="flex min-h-10 items-center sm:min-h-11">
        {/* Marquee track — two copies for seamless loop */}
        <div
          className="announcement-marquee flex shrink-0 items-center whitespace-nowrap"
          aria-live="polite"
        >
          <span className="inline-flex items-center px-8 text-xs font-medium tracking-wide sm:text-sm">
            <MarqueeTrack />
          </span>
          {/* Second copy for seamless loop — hidden from screen readers */}
          <span className="inline-flex items-center px-8 text-xs font-medium tracking-wide sm:text-sm" aria-hidden="true">
            <MarqueeTrack />
          </span>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            localStorage.setItem(STORAGE_KEY, "1");
          }}
          className="absolute right-1 z-10 inline-flex size-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:right-3 sm:size-11"
          aria-label="Zavřít oznámení"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
