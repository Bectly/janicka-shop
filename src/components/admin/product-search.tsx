"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";

export function ProductSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQuery = searchParams.get("q") ?? "";

  const handleSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      params.delete("page"); // Reset to page 1 on search
      startTransition(() => {
        router.push(`/admin/products?${params.toString()}`);
      });
    },
    [router, searchParams],
  );

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        placeholder="Hledat podle názvu, SKU nebo značky…"
        defaultValue={currentQuery}
        onChange={(e) => handleSearch(e.target.value)}
        className={`h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none transition-colors duration-150 placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary ${isPending ? "opacity-60" : ""}`}
      />
    </div>
  );
}
