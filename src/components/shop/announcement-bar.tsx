"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "janicka-announcement-dismissed";

const messages = [
  "🚚 Doprava zdarma od 1 500 Kč",
  "✨ Každý kousek je unikát — second hand & vintage",
  "↺ 14 dní na vrácení bez udání důvodu",
  "🌸 Prémiová kvalita, ověřený stav",
];

export function AnnouncementBar() {
  // Fix hydration mismatch: always render on server (hidden via useEffect), not via typeof window
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) {
      setDismissed(true);
    }
    setMounted(true);
  }, []);

  // Don't render until client-side hydration is complete
  if (!mounted || dismissed) return null;

  // Build doubled message string for seamless marquee loop
  const marqueeText = messages.join("  ✦  ");

  return (
    <div className="announcement-bar relative overflow-hidden bg-gradient-to-r from-brand via-brand-dark to-brand text-white">
      <div className="flex min-h-10 items-center sm:min-h-11">
        {/* Marquee track — two copies for seamless loop */}
        <div
          ref={marqueeRef}
          className="announcement-marquee flex shrink-0 items-center gap-0 whitespace-nowrap"
          aria-live="polite"
        >
          <span className="inline-block px-8 text-xs font-medium tracking-wide sm:text-sm">
            {marqueeText}
          </span>
          <span className="inline-block px-8 text-xs font-medium tracking-wide sm:text-sm">
            {marqueeText}
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
