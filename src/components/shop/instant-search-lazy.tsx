"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";

// Heavy module (MiniSearch ~27 KB gz) only fetched after first user intent.
const InstantSearchImpl = dynamic(
  () => import("./instant-search").then((m) => ({ default: m.InstantSearch })),
  { ssr: false },
);

interface InstantSearchLazyProps {
  variant?: "icon" | "bar";
}

export function InstantSearch({ variant = "icon" }: InstantSearchLazyProps) {
  const [hydrated, setHydrated] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);

  const prefetch = useCallback(() => setHydrated(true), []);
  const activate = useCallback(() => {
    setHydrated(true);
    setAutoOpen(true);
  }, []);

  // Bridge Ctrl/Cmd+K and "/" hotkey before the real component hydrates.
  // After hydration we bail out — the impl registers its own listener.
  useEffect(() => {
    if (hydrated) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        activate();
        return;
      }
      if (e.key === "/" && !isEditableTarget(e.target)) {
        e.preventDefault();
        activate();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activate, hydrated]);

  if (hydrated) {
    return <InstantSearchImpl variant={variant} defaultOpen={autoOpen} />;
  }

  if (variant === "bar") {
    return (
      <button
        onClick={activate}
        onMouseEnter={prefetch}
        onFocus={prefetch}
        onTouchStart={prefetch}
        className="flex w-full items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        aria-label="Hledat produkty"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left">Hledat produkty...</span>
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] sm:inline-flex">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <button
      onClick={activate}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-foreground/80 transition-colors duration-150 hover:bg-muted hover:text-foreground"
      aria-label="Hledat (Ctrl+K)"
    >
      <Search className="size-5" />
    </button>
  );
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}
