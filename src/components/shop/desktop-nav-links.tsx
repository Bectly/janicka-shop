"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useShuffleStore } from "@/lib/shuffle-store";

const navLinks = [
  { name: "Novinky", href: "/products?sort=newest", checkParam: null, slug: null },
  { name: "Šaty", href: "/products?category=saty", checkParam: "saty", slug: "saty" },
  { name: "Topy & Halenky", href: "/products?category=topy-halenky", checkParam: "topy-halenky", slug: "topy-halenky" },
  { name: "Kalhoty & Sukně", href: "/products?category=kalhoty-sukne", checkParam: "kalhoty-sukne", slug: "kalhoty-sukne" },
  { name: "Bundy & Kabáty", href: "/products?category=bundy-kabaty", checkParam: "bundy-kabaty", slug: "bundy-kabaty" },
  { name: "Doplňky", href: "/products?category=doplnky", checkParam: "doplnky", slug: "doplnky" },
];

interface DesktopNavLinksProps {
  categoryCounts?: Record<string, number>;
}

export function DesktopNavLinks({ categoryCounts }: DesktopNavLinksProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");
  const openShuffle = useShuffleStore((s) => s.openShuffle);

  return (
    <>
      {navLinks.map((link, idx) => {
        const isActive = link.checkParam
          ? pathname === "/products" && activeCategory === link.checkParam
          : pathname === "/products" &&
            !activeCategory &&
            searchParams.get("sort") === "newest";
        const count = link.slug && categoryCounts ? categoryCounts[link.slug] : undefined;

        const linkEl = (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
              isActive
                ? "bg-muted text-foreground"
                : "text-foreground/70 hover:bg-muted hover:text-foreground"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {link.name}
            {count !== undefined && count > 0 && (
              <span className="ml-1 text-xs opacity-50">({count})</span>
            )}
          </Link>
        );

        // Inject "Objevuj" button right after "Novinky" (idx === 0)
        if (idx === 0) {
          return (
            <span key="novinky-plus-objevuj" className="contents">
              {linkEl}
              <button
                key="objevuj"
                type="button"
                onClick={openShuffle}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/70 transition-colors duration-150 hover:bg-muted hover:text-foreground"
              >
                Objevuj
              </button>
            </span>
          );
        }

        return linkEl;
      })}
    </>
  );
}
