"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  dashboard: "Přehled",
  products: "Produkty",
  categories: "Kategorie",
  collections: "Kolekce",
  orders: "Objednávky",
  returns: "Vratky",
  customers: "Zákaznice",
  referrals: "Referraly",
  "abandoned-carts": "Opuštěné košíky",
  "browse-abandonment": "Prohlížení",
  subscribers: "Newsletter",
  settings: "Nastavení",
  jarvis: "JARVIS",
  new: "Nový",
  edit: "Upravit",
  "quick-add": "Rychlé přidání",
  coverage: "Pokrytí měr",
  welcome: "Vítej",
};

const LOOKS_LIKE_ID = /^(c[a-z0-9]{20,}|[0-9a-f-]{10,}|JN-[A-Z0-9]+)$/i;

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  if (LOOKS_LIKE_ID.test(segment)) return segment.slice(0, 10) + "…";
  // decode + prettify
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function Breadcrumbs() {
  const pathname = usePathname();
  if (!pathname || !pathname.startsWith("/admin")) return null;

  const segments = pathname.split("/").filter(Boolean);
  // Hide on top-level /admin or welcome/login
  if (
    segments.length <= 1 ||
    segments[1] === "welcome" ||
    segments[1] === "login"
  ) {
    return null;
  }

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    return { href, label: labelFor(seg), isLast: i === segments.length - 1 };
  });

  return (
    <nav aria-label="Drobečková navigace" className="flex items-center">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3 opacity-50" />}
            {i === 0 ? (
              <Link
                href="/admin/dashboard"
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Home className="size-3" />
                <span className="sr-only sm:not-sr-only">{c.label}</span>
              </Link>
            ) : c.isLast ? (
              <span className="font-medium text-foreground">{c.label}</span>
            ) : (
              <Link href={c.href} className="hover:text-foreground">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
