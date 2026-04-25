"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import type { HumanTaskPriority } from "@/lib/jarvis-db";

const FILTERS: Array<{ key: "all" | HumanTaskPriority; label: string }> = [
  { key: "all", label: "Všechny" },
  { key: "urgent", label: "Urgentní" },
  { key: "high", label: "Vysoká" },
  { key: "medium", label: "Střední" },
  { key: "low", label: "Nízká" },
];

export function PriorityFilter({
  active,
}: {
  active: "all" | HumanTaskPriority;
}) {
  const params = useSearchParams();

  function hrefFor(key: string) {
    const next = new URLSearchParams(params.toString());
    if (key === "all") next.delete("priority");
    else next.set("priority", key);
    const qs = next.toString();
    return qs ? `/admin/manager?${qs}` : "/admin/manager";
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const isActive = active === f.key;
        return (
          <Link
            key={f.key}
            href={hrefFor(f.key)}
            scroll={false}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
