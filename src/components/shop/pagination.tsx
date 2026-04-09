"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  totalItems: number;
  perPage: number;
  /** Base path for navigation (default: current pathname) */
  basePath?: string;
}

export function Pagination({ totalItems, perPage, basePath }: PaginationProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentPage = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const path = basePath ?? pathname;

  function getPageHref(page: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }

  if (totalPages <= 1) return null;

  // Build page numbers to show: always first, last, and 2 around current
  const pages: (number | "ellipsis")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - 1 && i <= currentPage + 1)
    ) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  const linkBase =
    "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors";
  const pageBase =
    "min-w-[2.25rem] rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors";

  return (
    <nav
      aria-label="Stránkování"
      className="mt-12 flex items-center justify-center gap-1"
    >
      {/* Previous */}
      {currentPage <= 1 ? (
        <span
          className={`${linkBase} text-muted-foreground pointer-events-none opacity-40`}
          aria-disabled="true"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Předchozí</span>
        </span>
      ) : (
        <Link
          href={getPageHref(currentPage - 1)}
          className={`${linkBase} text-muted-foreground hover:bg-muted`}
          aria-label="Předchozí stránka"
          scroll
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Předchozí</span>
        </Link>
      )}

      {/* Page numbers */}
      {pages.map((page, idx) =>
        page === "ellipsis" ? (
          <span
            key={`e-${idx}`}
            className="px-2 text-sm text-muted-foreground"
          >
            &hellip;
          </span>
        ) : page === currentPage ? (
          <span
            key={page}
            className={`${pageBase} bg-primary text-primary-foreground`}
            aria-label={`Stránka ${page}`}
            aria-current="page"
          >
            {page}
          </span>
        ) : (
          <Link
            key={page}
            href={getPageHref(page)}
            className={`${pageBase} text-muted-foreground hover:bg-muted`}
            aria-label={`Stránka ${page}`}
            scroll
          >
            {page}
          </Link>
        ),
      )}

      {/* Next */}
      {currentPage >= totalPages ? (
        <span
          className={`${linkBase} text-muted-foreground pointer-events-none opacity-40`}
          aria-disabled="true"
        >
          <span className="hidden sm:inline">Další</span>
          <ChevronRight className="size-4" />
        </span>
      ) : (
        <Link
          href={getPageHref(currentPage + 1)}
          className={`${linkBase} text-muted-foreground hover:bg-muted`}
          aria-label="Další stránka"
          scroll
        >
          <span className="hidden sm:inline">Další</span>
          <ChevronRight className="size-4" />
        </Link>
      )}
    </nav>
  );
}
