"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const PERIODS = [
  { value: "today", label: "Dnes" },
  { value: "7d", label: "7 dní" },
  { value: "30d", label: "30 dní" },
  { value: "all", label: "Vše" },
] as const;

export function PeriodSelector({
  activePeriod,
}: {
  activePeriod: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePeriodChange = useCallback(
    (period: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (period === "all") {
        params.delete("period");
      } else {
        params.set("period", period);
      }
      router.push(`/admin/dashboard?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div
      className="flex gap-1 rounded-lg border bg-muted/50 p-1"
      role="group"
      aria-label="Období statistik"
    >
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => handlePeriodChange(p.value)}
          aria-pressed={activePeriod === p.value}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            activePeriod === p.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
