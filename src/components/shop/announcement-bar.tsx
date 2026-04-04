"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "janicka-announcement-dismissed";

const messages = [
  "Doprava zdarma od 1 500 Kč",
  "Každý kousek je unikát — second hand & vintage",
  "14 dní na vrácení bez udání důvodu",
];

export function AnnouncementBar() {
  // Lazy initializer: SSR returns true (hidden), client reads localStorage on mount.
  // Avoids extra render from useEffect + setState pattern.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return !!localStorage.getItem(STORAGE_KEY);
  });
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (dismissed) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div className="relative bg-primary text-primary-foreground">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium sm:text-sm">
          {messages[currentIndex]}
        </p>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            localStorage.setItem(STORAGE_KEY, "1");
          }}
          className="absolute right-2 inline-flex items-center justify-center rounded p-1 text-primary-foreground/70 transition-colors hover:text-primary-foreground sm:right-4"
          aria-label="Zavřít oznámení"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
