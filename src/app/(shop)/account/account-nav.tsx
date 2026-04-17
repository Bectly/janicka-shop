"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, User } from "lucide-react";
import { SignOutButton } from "./sign-out-button";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/account", icon: LayoutDashboard, label: "Přehled", exact: true },
  { href: "/account/orders", icon: Package, label: "Objednávky", exact: false },
  { href: "/account/profile", icon: User, label: "Profil", exact: false },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Účet — navigace" className="md:sticky md:top-20 md:self-start">
      <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
        <li className="md:mt-2">
          <SignOutButton>
            <LogOut className="size-4" />
            <span>Odhlásit se</span>
          </SignOutButton>
        </li>
      </ul>
    </nav>
  );
}
