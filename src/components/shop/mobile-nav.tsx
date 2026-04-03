"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const categories = [
  { name: "Šaty", href: "/products?category=saty" },
  { name: "Topy & Halenky", href: "/products?category=topy-halenky" },
  { name: "Kalhoty & Sukně", href: "/products?category=kalhoty-sukne" },
  { name: "Bundy & Kabáty", href: "/products?category=bundy-kabaty" },
  { name: "Doplňky", href: "/products?category=doplnky" },
];

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden" />
        }
      >
        <Menu className="size-5" />
        <span className="sr-only">Menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>
            <Link href="/" className="font-heading text-xl font-bold text-primary">
              Janička
            </Link>
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4">
          <Link
            href="/products"
            className="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Všechny produkty
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
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
