"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { InstantSearch } from "./instant-search";

const categories = [
  { name: "Šaty", href: "/products?category=saty" },
  { name: "Topy & Halenky", href: "/products?category=topy-halenky" },
  { name: "Kalhoty & Sukně", href: "/products?category=kalhoty-sukne" },
  { name: "Bundy & Kabáty", href: "/products?category=bundy-kabaty" },
  { name: "Doplňky", href: "/products?category=doplnky" },
];

const topLinks = [
  { name: "Novinky", href: "/products?sort=newest" },
  { name: "Všechny produkty", href: "/products" },
  { name: "Oblíbené", href: "/oblibene" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");
  const activeSort = searchParams.get("sort");

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
        {/* Search trigger in mobile nav */}
        <div className="px-4 pb-2">
          <InstantSearch />
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
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-muted text-foreground" : "hover:bg-muted"
                }`}
              >
                {link.name}
              </Link>
            );
          })}
          <div className="my-1 border-t" />
          <p className="px-3 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Kategorie
          </p>
          {categories.map((cat) => {
            const slug = cat.href.split("category=")[1];
            const isActive = pathname === "/products" && activeCategory === slug;
            return (
              <Link
                key={cat.href}
                href={cat.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {cat.name}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
