"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder that matches pagination height — prevents layout shift during Suspense. */
export function PaginationSkeleton() {
  return (
    <div className="mt-12 flex items-center justify-center gap-1">
      <Skeleton className="h-11 w-24 rounded-lg" />
      <Skeleton className="h-11 w-11 rounded-lg" />
      <Skeleton className="h-11 w-11 rounded-lg" />
      <Skeleton className="h-11 w-11 rounded-lg" />
      <Skeleton className="h-11 w-24 rounded-lg" />
    </div>
  );
}

interface PaginationProps {
  totalItems: number;
  perPage: number;
  /** Base path for navigation (default: current pathname). Ignored in controlled mode. */
  basePath?: string;
  /**
   * When `currentPage` + `onPageChange` are provided, Pagination is fully
   * controlled and renders buttons instead of links — used by the client-side
   * catalog so page changes do NOT trigger an RSC round-trip.
   */
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export function Pagination({
  totalItems,
  perPage,
  basePath,
  currentPage: controlledPage,
  onPageChange,
}: PaginationProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isControlled = typeof controlledPage === "number" && typeof onPageChange === "function";
  const currentPage = isControlled
    ? Math.max(1, controlledPage!)
    : Math.max(1, parseInt(searchParams.get("page") ?? "1"));
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
    "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors";
  const pageBase =
    "inline-flex min-h-[44px] min-w-11 items-center justify-center rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors";

  function goTo(p: number) {
    if (!isControlled) return;
    onPageChange!(p);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

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
      ) : isControlled ? (
        <button
          type="button"
          onClick={() => goTo(currentPage - 1)}
          className={`${linkBase} text-muted-foreground hover:bg-muted`}
          aria-label="Předchozí stránka"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Předchozí</span>
        </button>
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
        ) : isControlled ? (
          <button
            key={page}
            type="button"
            onClick={() => goTo(page)}
            className={`${pageBase} text-muted-foreground hover:bg-muted`}
            aria-label={`Stránka ${page}`}
          >
            {page}
          </button>
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
      ) : isControlled ? (
        <button
          type="button"
          onClick={() => goTo(currentPage + 1)}
          className={`${linkBase} text-muted-foreground hover:bg-muted`}
          aria-label="Další stránka"
        >
          <span className="hidden sm:inline">Další</span>
          <ChevronRight className="size-4" />
        </button>
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
