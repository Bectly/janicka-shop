import Link from "next/link";
import { CartButton } from "./cart-button";
import { WishlistHeaderButton } from "./wishlist-header-button";
import { MobileNav } from "./mobile-nav";
import { InstantSearch } from "./instant-search";

const navLinks = [
  { name: "Novinky", href: "/products?sort=newest" },
  { name: "Šaty", href: "/products?category=saty" },
  { name: "Topy & Halenky", href: "/products?category=topy-halenky" },
  { name: "Kalhoty & Sukně", href: "/products?category=kalhoty-sukne" },
  { name: "Bundy & Kabáty", href: "/products?category=bundy-kabaty" },
  { name: "Doplňky", href: "/products?category=doplnky" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Mobile menu */}
        <MobileNav />

        {/* Logo */}
        <Link
          href="/"
          className="font-heading text-xl font-bold tracking-tight text-primary"
        >
          Janička
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Hlavní navigace" className="hidden flex-1 items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.name}
            </Link>
          ))}
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
