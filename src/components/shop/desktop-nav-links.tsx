"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const navLinks = [
  { name: "Novinky", href: "/products?sort=newest", checkParam: null },
  { name: "Šaty", href: "/products?category=saty", checkParam: "saty" },
  { name: "Topy & Halenky", href: "/products?category=topy-halenky", checkParam: "topy-halenky" },
  { name: "Kalhoty & Sukně", href: "/products?category=kalhoty-sukne", checkParam: "kalhoty-sukne" },
  { name: "Bundy & Kabáty", href: "/products?category=bundy-kabaty", checkParam: "bundy-kabaty" },
  { name: "Doplňky", href: "/products?category=doplnky", checkParam: "doplnky" },
];

export function DesktopNavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");

  return (
    <>
      {navLinks.map((link) => {
        const isActive = link.checkParam
          ? pathname === "/products" && activeCategory === link.checkParam
          : pathname === "/products" && !activeCategory && searchParams.get("sort") === "newest";

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-muted text-foreground"
                : "text-foreground/70 hover:bg-muted hover:text-foreground"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {link.name}
          </Link>
        );
      })}
    </>
  );
}
