import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { CartButton } from "./cart-button";
import { WishlistHeaderButton } from "./wishlist-header-button";
import { MobileNav } from "./mobile-nav";
import { InstantSearch } from "./instant-search";
import { DesktopNavLinks } from "./desktop-nav-links";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Mobile menu — Suspense needed because MobileNav reads searchParams */}
        <Suspense fallback={<div className="size-11 md:hidden" />}>
          <MobileNav />
        </Suspense>

        {/* Logo */}
        <Link href="/" className="inline-flex min-h-[44px] shrink-0 items-center" aria-label="Janička — domů">
          <Image
            src="/logo/logo-header.png"
            alt=""
            width={120}
            height={48}
            className="h-8 w-auto"
            priority
          />
        </Link>

        {/* Desktop nav — Suspense needed because DesktopNavLinks reads searchParams */}
        <nav aria-label="Hlavní navigace" className="hidden flex-1 items-center gap-1 md:flex">
          <Suspense
            fallback={
              <div className="flex items-center gap-1">
                {["Novinky","Šaty","Topy & Halenky","Kalhoty & Sukně","Bundy & Kabáty","Doplňky"].map((name) => (
                  <span key={name} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/70">
                    {name}
                  </span>
                ))}
              </div>
            }
          >
            <DesktopNavLinks />
          </Suspense>
        </nav>

        {/* Right side: search + cart */}
        <div className="ml-auto flex items-center gap-1">
          <InstantSearch />
          <WishlistHeaderButton />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
