"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu } from "lucide-react";
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] md:hidden" />
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
          {topLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              {link.name}
            </Link>
          ))}
          <div className="my-1 border-t" />
          <p className="px-3 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Kategorie
          </p>
          {categories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {cat.name}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
