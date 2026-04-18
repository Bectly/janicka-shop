"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, ShoppingBag, User } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

interface Tab {
  name: string;
  href: string;
  icon: typeof Home;
  matchExact?: boolean;
  badge?: "wishlist" | "cart";
}

const tabs: Tab[] = [
  { name: "Domů", href: "/", icon: Home, matchExact: true },
  { name: "Hledat", href: "/search", icon: Search },
  { name: "Oblíbené", href: "/oblibene", icon: Heart, badge: "wishlist" },
  { name: "Košík", href: "/cart", icon: ShoppingBag, badge: "cart" },
  { name: "Účet", href: "/objednavka", icon: User },
];

// Routes where bottom nav should be hidden
const hiddenPrefixes = ["/checkout", "/admin", "/pick/"];

export function BottomNav() {
  const pathname = usePathname();
  const totalItems = useCartStore((s) => s.totalItems);
  const wishlistCount = useWishlistStore((s) => s.count);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const cartCount = mounted ? totalItems() : 0;
  const wlCount = mounted ? wishlistCount() : 0;

  if (hiddenPrefixes.some((r) => pathname.startsWith(r))) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 lg:hidden pb-[env(safe-area-inset-bottom,_0px)]"
      aria-label="Spodní navigace"
    >
      <div className="mx-auto flex h-14 max-w-lg items-stretch justify-around">
        {tabs.map((tab) => {
          const isActive = tab.matchExact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          const badge =
            tab.badge === "cart"
              ? cartCount
              : tab.badge === "wishlist"
                ? wlCount
                : 0;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 transition-all duration-150 active:scale-95 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
              aria-label={`${tab.name}${badge > 0 ? ` (${badge})` : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Active indicator line */}
              {isActive && (
                <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
              )}
              <span className="relative">
                <Icon
                  className="size-[22px]"
                  strokeWidth={isActive ? 2.5 : 1.75}
                  fill={isActive && tab.icon === Heart ? "currentColor" : "none"}
                />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold leading-none text-primary-foreground whitespace-nowrap">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] leading-none ${
                  isActive ? "font-semibold" : "font-medium"
                }`}
              >
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
