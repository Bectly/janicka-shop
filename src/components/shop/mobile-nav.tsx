"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, User, LogIn, Shuffle } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InstantSearch } from "./instant-search-lazy";
import { useShuffleStore } from "@/lib/shuffle-store";

const categories = [
  { name: "Šaty", href: "/products?category=saty" },
  { name: "Topy & Halenky", href: "/products?category=topy-halenky" },
  { name: "Kalhoty & Sukně", href: "/products?category=kalhoty-sukne" },
  { name: "Bundy & Kabáty", href: "/products?category=bundy-kabaty" },
  { name: "Boty", href: "/products?category=boty" },
  { name: "Doplňky", href: "/products?category=doplnky" },
];

const topLinks = [
  { name: "Novinky", href: "/products?sort=newest" },
  { name: "Všechny produkty", href: "/products" },
  { name: "Oblíbené", href: "/oblibene" },
];

interface MobileNavProps {
  categoryCounts?: Record<string, number>;
  sessionRole?: "customer" | null;
}

export function MobileNav({ categoryCounts, sessionRole }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");
  const activeSort = searchParams.get("sort");
  const openShuffle = useShuffleStore((s) => s.openShuffle);

  // Close sheet on any route/search-param change (handles cases where
  // onClick={() => setOpen(false)} on Link doesn't propagate through
  // Base UI Dialog, or when the user navigates via browser back/forward).
  const searchParamsStr = searchParams.toString();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- route-change drawer close: syncs UI with external navigation (browser back/forward, programmatic routing) that bypasses onClick handlers
    setOpen(false);
  }, [pathname, searchParamsStr]);

  function topLinkActive(href: string) {
    if (href === "/products?sort=newest") return pathname === "/products" && activeSort === "newest" && !activeCategory;
    if (href === "/products") return pathname === "/products" && !activeCategory && activeSort !== "newest";
    return pathname === href;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="!size-11 md:hidden" />
        }
      >
        <Menu className="size-5" />
        <span className="sr-only">Menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>
            <Link href="/" onClick={() => setOpen(false)} className="inline-block">
              <Image
                src="/logo/logo-header.png"
                alt="Janička"
                width={120}
                height={48}
                className="h-8 w-auto"
              />
            </Link>
          </SheetTitle>
        </SheetHeader>
        {/* Search bar in mobile nav */}
        <div className="px-4 pb-3">
          <InstantSearch variant="bar" />
        </div>

        <nav aria-label="Hlavní navigace" className="flex flex-col gap-1 px-4">
          {topLinks.map((link) => {
            const isActive = topLinkActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  isActive ? "bg-muted text-foreground" : "hover:bg-muted"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openShuffle();
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-foreground/80 transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <Shuffle className="size-4 text-primary" />
            Objevuj
          </button>
          <div className="my-1 border-t" />
          <p className="px-3 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Kategorie
          </p>
          {categories.map((cat) => {
            const slug = cat.href.split("category=")[1];
            const isActive = pathname === "/products" && activeCategory === slug;
            const count = slug && categoryCounts ? categoryCounts[slug] : undefined;
            return (
              <Link
                key={cat.href}
                href={cat.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 ${
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat.name}
                {count !== undefined && count > 0 && (
                  <span className="text-xs opacity-50">({count})</span>
                )}
              </Link>
            );
          })}
          <div className="my-1 border-t" />
          {sessionRole === "customer" ? (
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              aria-current={pathname.startsWith("/account") ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname.startsWith("/account")
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <User className="size-4" />
              Můj účet
            </Link>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              aria-current={pathname === "/login" ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === "/login"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <LogIn className="size-4" />
              Přihlásit se
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
