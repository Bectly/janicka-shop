"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  LogOut,
  Store,
  Tags,
  Zap,
  Mail,
  Inbox,
  Layers,
  RotateCcw,
  Gift,
  ShoppingBag,
  Eye,
  PenLine,
  Ruler,
  Terminal,
} from "lucide-react";

type NavItem =
  | { href: string; label: string; icon: React.ElementType; divider?: false }
  | { divider: true };

const navItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Přehled", icon: LayoutDashboard },
  { href: "/admin/products/quick-add", label: "Rychlé přidání", icon: Zap },
  { href: "/admin/products", label: "Produkty", icon: Package },
  { href: "/admin/products/coverage", label: "Pokrytí měr", icon: Ruler },
  { href: "/admin/categories", label: "Kategorie", icon: Tags },
  { href: "/admin/collections", label: "Kolekce", icon: Layers },
  { href: "/admin/orders", label: "Objednávky", icon: ShoppingCart },
  { href: "/admin/returns", label: "Vratky", icon: RotateCcw },
  { href: "/admin/customers", label: "Zákazníci", icon: Users },
  { href: "/admin/referrals", label: "Referraly", icon: Gift },
  { href: "/admin/abandoned-carts", label: "Opuštěné košíky", icon: ShoppingBag },
  { href: "/admin/browse-abandonment", label: "Prohlížení", icon: Eye },
  { href: "/admin/mailbox", label: "Schránka", icon: Inbox },
  { href: "/admin/subscribers", label: "Newsletter", icon: Mail },
  { href: "/admin/email-templates", label: "E-mail editor", icon: PenLine },
  { divider: true },
  { href: "/admin/settings", label: "Nastavení", icon: Settings },
  { href: "/admin/jarvis", label: "JARVIS", icon: Terminal },
];

export function AdminSidebar({
  userName,
  ordersLast24h = 0,
  mailboxUnread = 0,
}: {
  userName: string;
  ordersLast24h?: number;
  mailboxUnread?: number;
}) {
  const pathname = usePathname();

  return (
    <aside aria-label="Administrace" className="sticky top-0 flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Store className="size-5 text-primary" />
        <span className="font-heading text-lg font-bold text-primary">
          Janička
        </span>
        <span className="text-xs text-muted-foreground">Admin</span>
      </div>

      {/* Navigation */}
      <nav aria-label="Hlavní menu" className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item, i) => {
          if ("divider" in item && item.divider) {
            return <hr key={`divider-${i}`} className="my-1 border-border/50" />;
          }
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          const showOrderBadge = item.href === "/admin/orders" && ordersLast24h > 0;
          const showMailboxBadge = item.href === "/admin/mailbox" && mailboxUnread > 0;
          const badgeValue = showOrderBadge ? ordersLast24h : showMailboxBadge ? mailboxUnread : 0;
          const badgeTitle = showOrderBadge
            ? `Posledních 24h: ${ordersLast24h} nových objednávek`
            : showMailboxBadge
              ? `${mailboxUnread} nepřečtených e-mailů`
              : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              title={badgeTitle}
            >
              <Icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {badgeValue > 0 ? (
                <span
                  aria-label={badgeTitle}
                  className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground"
                >
                  {badgeValue > 99 ? "99+" : badgeValue}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* User / Logout */}
      <div className="border-t p-4">
        <div className="mb-3 text-sm">
          <p className="font-medium text-foreground">{userName}</p>
          <Link
            href="/"
            className="text-xs text-muted-foreground transition-colors duration-150 hover:text-primary"
          >
            Zobrazit obchod &rarr;
          </Link>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive active:scale-95"
        >
          <LogOut className="size-4" />
          Odhlásit se
        </button>
      </div>
    </aside>
  );
}
