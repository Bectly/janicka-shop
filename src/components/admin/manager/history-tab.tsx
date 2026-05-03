"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

import { ArtifactCard } from "@/components/admin/manager/artifact-card";
import { cn } from "@/lib/utils";

type ArtifactRow = {
  id: string;
  kind: string;
  title: string | null;
  bodyMd: string | null;
  bodyJson: string | null;
  status: string;
  mood: string | null;
  createdAt: Date | string;
  comments?: Array<{
    id: string;
    authorRole: string;
    authorName: string | null;
    bodyMd: string;
    createdAt: Date | string;
  }>;
};

type DayBucket = {
  key: string;
  label: string;
  items: ArtifactRow[];
};

const DAY_FORMATTER = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Prague",
});

const KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Prague",
});

function bucketKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return KEY_FORMATTER.format(date);
}

function bucketLabel(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const today = new Date();
  const diffDays = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (sameDay) return "Dnes";
  if (diffDays === 1) return "Včera";
  return DAY_FORMATTER.format(date);
}

export function HistoryTab({ artifacts }: { artifacts: ArtifactRow[] }) {
  const buckets = useMemo<DayBucket[]>(() => {
    // eslint-disable-next-line react-hooks/purity -- cutoff intentionally read at render
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = artifacts.filter((a) => {
      const ts =
        typeof a.createdAt === "string"
          ? new Date(a.createdAt).getTime()
          : a.createdAt.getTime();
      return ts >= cutoff;
    });
    const map = new Map<string, DayBucket>();
    for (const a of recent) {
      const key = bucketKey(a.createdAt);
      const existing = map.get(key);
      if (existing) {
        existing.items.push(a);
      } else {
        map.set(key, {
          key,
          label: bucketLabel(a.createdAt),
          items: [a],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.key < b.key ? 1 : a.key > b.key ? -1 : 0,
    );
  }, [artifacts]);

  const [openKeys, setOpenKeys] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (buckets[0]) initial.add(buckets[0].key);
    return initial;
  });

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (buckets.length === 0) {
    return (
      <div className="space-y-4">
        <header className="flex items-center gap-2">
          <Calendar className="size-5 text-primary" />
          <h2 className="font-heading text-lg sm:text-xl font-semibold">
            Historie · 7 dní
          </h2>
        </header>
        <div className="rounded-lg border border-dashed bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Posledních 7 dní žádné záznamy. Manažerka zatím nic neposlala.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <Calendar className="size-5 text-primary" />
        <h2 className="font-heading text-lg sm:text-xl font-semibold">
          Historie · 7 dní
        </h2>
      </header>

      <div className="space-y-2">
        {buckets.map((bucket) => {
          const isOpen = openKeys.has(bucket.key);
          return (
            <section
              key={bucket.key}
              className="rounded-lg border bg-card shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggle(bucket.key)}
                aria-expanded={isOpen}
                aria-controls={`history-bucket-${bucket.key}`}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left hover:bg-foreground/[0.03]"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm capitalize">
                    {bucket.label}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {bucket.items.length}{" "}
                    {bucket.items.length === 1
                      ? "položka"
                      : bucket.items.length < 5
                        ? "položky"
                        : "položek"}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen && (
                <div
                  id={`history-bucket-${bucket.key}`}
                  className="border-t px-4 py-3 space-y-3"
                >
                  {bucket.items.map((a) => (
                    <ArtifactCard
                      key={a.id}
                      artifact={{
                        id: a.id,
                        kind: a.kind,
                        title: a.title,
                        bodyMd: a.bodyMd,
                        bodyJson: a.bodyJson,
                        status: a.status,
                        mood: a.mood,
                        createdAt: a.createdAt,
                        comments: a.comments,
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
