import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { CartButton } from "./cart-button";
import { WishlistHeaderButton } from "./wishlist-header-button";
import { MobileNav } from "./mobile-nav";
import { InstantSearch } from "./instant-search";
import { DesktopNavLinks } from "./desktop-nav-links";
import { AccountHeaderButton } from "./account-header-button";
import { getCategoriesWithCounts } from "@/lib/category-counts";
import { auth } from "@/lib/auth";
import { connection } from "next/server";

const NAV_NAMES = ["Novinky", "Šaty", "Topy & Halenky", "Kalhoty & Sukně", "Bundy & Kabáty", "Doplňky"];

async function HeaderNav() {
  await connection();
  let categories: Awaited<ReturnType<typeof getCategoriesWithCounts>> = [];
  try {
    categories = await getCategoriesWithCounts();
  } catch {
    // DB unavailable — nav renders without counts, page still works
  }
  const categoryCounts: Record<string, number> = {};
  for (const c of categories) {
    categoryCounts[c.slug] = c.count;
  }

  const session = await auth();
  const sessionRole = session?.user?.role === "customer" ? "customer" as const : null;

  return (
    <>
      {/* Mobile menu */}
      <Suspense fallback={<div className="size-11 md:hidden" />}>
        <MobileNav categoryCounts={categoryCounts} sessionRole={sessionRole} />
      </Suspense>

      {/* Desktop nav — DesktopNavLinks reads searchParams so needs Suspense */}
      <nav aria-label="Hlavní navigace" className="hidden flex-1 items-center gap-1 md:flex">
        <Suspense
          fallback={
            <div className="flex items-center gap-1">
              {NAV_NAMES.map((name) => (
                <span key={name} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/70">
                  {name}
                </span>
              ))}
            </div>
          }
        >
          <DesktopNavLinks categoryCounts={categoryCounts} />
        </Suspense>
      </nav>
    </>
  );
}

export function Header() {
  return (
    <header data-hide-on-lightbox className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Suspense
          fallback={
            <>
              <div className="size-11 md:hidden" />
              <nav aria-label="Hlavní navigace" className="hidden flex-1 items-center gap-1 md:flex">
                <div className="flex items-center gap-1">
                  {NAV_NAMES.map((name) => (
                    <span key={name} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/70">
                      {name}
                    </span>
                  ))}
                </div>
              </nav>
            </>
          }
        >
          <HeaderNav />
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

        {/* Spacer to push right-side icons when nav is loading */}
        <div className="hidden flex-1 md:block" />

        {/* Right side: search + account + wishlist + cart */}
        <div className="ml-auto flex items-center gap-1">
          <InstantSearch />
          <Suspense fallback={<div className="size-11" />}>
            <AccountHeaderButton />
          </Suspense>
          <WishlistHeaderButton />
          <CartButton />
        </div>
      </div>
    </header>
  );
}
