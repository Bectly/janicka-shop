"use client";

import { useEffect, useState } from "react";

function formatTimeElapsed(date: Date): string | null {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return null;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return "Právě přidáno";
  if (diffHours < 24) return `Před ${diffHours}h`;
  if (diffDays < 7) return `Před ${diffDays}d`;
  return null;
}

interface TimeElapsedBadgeProps {
  createdAt: Date | string;
}

// Renders nothing on SSR so the static HTML never disagrees with what the
// client computes after hydration (Date.now() drifts between server and
// client and used to throw React #418/#419 from the product grid).
export function TimeElapsedBadge({ createdAt }: TimeElapsedBadgeProps) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional client-only render: Date.now() must run post-hydration to avoid React #418 mismatch
    setLabel(formatTimeElapsed(created));
  }, [createdAt]);

  if (!label) return null;
  return (
    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm">
      {label}
    </span>
  );
}
