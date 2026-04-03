"use client";

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
} from "lucide-react";

const navItems = [
  { href: "/admin/dashboard", label: "Přehled", icon: LayoutDashboard },
  { href: "/admin/products", label: "Produkty", icon: Package },
  { href: "/admin/categories", label: "Kategorie", icon: Tags },
  { href: "/admin/orders", label: "Objednávky", icon: ShoppingCart },
  { href: "/admin/customers", label: "Zákazníci", icon: Users },
  { href: "/admin/settings", label: "Nastavení", icon: Settings },
];

export function AdminSidebar({ userName }: { userName: string }) {
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
      <nav aria-label="Administrace" className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
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
            className="text-xs text-muted-foreground hover:text-primary"
          >
            Zobrazit obchod &rarr;
          </Link>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="size-4" />
          Odhlásit se
        </button>
      </div>
    </aside>
  );
}
