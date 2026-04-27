"use client";

import { Shuffle } from "lucide-react";
import { usePathname } from "next/navigation";
import { useShuffleStore } from "@/lib/shuffle-store";

export function ShuffleButton() {
  const pathname = usePathname();
  const open = useShuffleStore((s) => s.open);
  const openShuffle = useShuffleStore((s) => s.openShuffle);

  // Hide inside admin/account/checkout flows + PDP detail (sticky add-to-cart bar collision)
  if (
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/account") ||
    pathname?.startsWith("/checkout") ||
    pathname?.startsWith("/login") ||
    pathname?.startsWith("/products/")
  ) {
    return null;
  }

  if (open) return null;

  return (
    <button
      type="button"
      data-hide-on-lightbox
      onClick={openShuffle}
      aria-label="Objevuj náhodné kousky"
      className="fixed z-40 right-4 lg:right-auto lg:left-4 bottom-[calc(5rem+env(safe-area-inset-bottom,_0px))] lg:bottom-6 inline-flex size-11 lg:size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-background transition-transform duration-150 hover:scale-105 active:scale-95 animate-shuffle-bounce focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2"
    >
      <Shuffle className="size-6" />
      <span className="sr-only">Objevuj</span>
    </button>
  );
}
