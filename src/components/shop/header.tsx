import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { CartButton } from "./cart-button";
import { WishlistHeaderButton } from "./wishlist-header-button";
import { MobileNav } from "./mobile-nav";
import { InstantSearch } from "./instant-search-lazy";
import { DesktopNavLinks } from "./desktop-nav-links";
import { AccountHeaderButton } from "./account-header-button";
import { getCategoriesWithCounts } from "@/lib/category-counts";
import { auth } from "@/lib/auth";
import { connection } from "next/server";

const NAV_NAMES = ["Novinky", "Šaty", "Topy & Halenky", "Kalhoty & Sukně", "Bundy & Kabáty", "Doplňky"];

async function fetchHeaderData() {
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
  const sessionRole = session?.user?.role === "customer" ? ("customer" as const) : null;
  return { categoryCounts, sessionRole };
}

async function MobileFloating() {
  const { categoryCounts, sessionRole } = await fetchHeaderData();
  return (
    <div
      data-hide-on-lightbox
      className="fixed left-3 top-3 z-50 inline-flex items-center rounded-2xl border border-brand/15 bg-gradient-to-br from-blush-light/90 via-background/85 to-blush/40 shadow-[0_4px_18px_-6px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-md transition-shadow duration-200 hover:shadow-[0_8px_22px_-6px_oklch(0.55_0.20_350_/_0.30)] md:hidden"
    >
      <MobileNav categoryCounts={categoryCounts} sessionRole={sessionRole} variant="embedded" />
      {/* Vertical brand-tinted divider — visually unifies hamburger + logo as one piece */}
      <span aria-hidden="true" className="h-6 w-px bg-gradient-to-b from-transparent via-brand/25 to-transparent" />
      <Link
        href="/"
        className="inline-flex items-center rounded-r-2xl pr-3 pl-2.5 py-1 transition-colors duration-200 hover:bg-brand/5"
        aria-label="Janička — domů"
      >
        <Image
          src="/logo/logo-header.png"
          alt=""
          width={88}
          height={48}
          className="h-6 w-auto"
          priority
        />
      </Link>
    </div>
  );
}

async function DesktopNav() {
  const { categoryCounts } = await fetchHeaderData();
  return (
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
  );
}

function MobileFallback() {
  return (
    <div className="fixed left-3 top-3 z-50 inline-flex h-11 items-center rounded-2xl border border-brand/15 bg-blush-light/50 backdrop-blur-md md:hidden">
      <div className="size-11" />
      <span className="h-6 w-px bg-brand/20" />
      <div className="h-6 w-20 mx-3 rounded bg-brand/10" />
    </div>
  );
}

export function Header() {
  return (
    <>
      {/* Mobile: floating compact cluster (hamburger pill + small logo) anchored
          top-left. Replaces the full-width sticky bar on mobile so the page
          doesn't lose ~56px of vertical viewport — every per-page action lives
          in BottomNav already, so a top bar would be wasted chrome. */}
      <Suspense fallback={<MobileFallback />}>
        <MobileFloating />
      </Suspense>

      {/* Desktop: sticky full-width header bar, layout unchanged. */}
      <header
        data-hide-on-lightbox
        className="sticky top-0 z-40 hidden border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 md:block"
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Suspense
            fallback={
              <nav aria-label="Hlavní navigace" className="hidden flex-1 items-center gap-1 md:flex">
                <div className="flex items-center gap-1">
                  {NAV_NAMES.map((name) => (
                    <span key={name} className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/70">
                      {name}
                    </span>
                  ))}
                </div>
              </nav>
            }
          >
            <DesktopNav />
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

          <div className="flex-1" />

          {/* Right side */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <InstantSearch />
            <Suspense fallback={<div className="size-11" />}>
              <AccountHeaderButton />
            </Suspense>
            <WishlistHeaderButton />
            <CartButton />
          </div>
        </div>
      </header>
    </>
  );
}
