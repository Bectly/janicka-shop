"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  totalItems: number;
  perPage: number;
  /** Base path for navigation (default: current path) */
  basePath?: string;
}

export function Pagination({ totalItems, perPage, basePath }: PaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
      const qs = params.toString();
      const path = basePath ?? "/products";
      router.push(qs ? `${path}?${qs}` : path, { scroll: true });
    },
    [router, searchParams, basePath],
  );

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

  return (
    <nav aria-label="Stránkování" className="mt-12 flex items-center justify-center gap-1">
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        aria-label="Předchozí stránka"
      >
        <ChevronLeft className="size-4" />
        <span className="hidden sm:inline">Předchozí</span>
      </button>

      {pages.map((page, idx) =>
        page === "ellipsis" ? (
          <span key={`e-${idx}`} className="px-2 text-sm text-muted-foreground">
            &hellip;
          </span>
        ) : (
          <button
            key={page}
            onClick={() => goToPage(page)}
            className={`min-w-[2.25rem] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              page === currentPage
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
            aria-label={`Stránka ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        ),
      )}

      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        aria-label="Další stránka"
      >
        <span className="hidden sm:inline">Další</span>
        <ChevronRight className="size-4" />
      </button>
    </nav>
  );
}
