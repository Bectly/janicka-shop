"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useTransition } from "react";

export function CustomerTagFilter({
  tags,
  activeTag,
}: {
  tags: string[];
  activeTag: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (tags.length === 0 && !activeTag) return null;

  function setTag(next: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("tag", next);
    else params.delete("tag");
    params.delete("page");
    startTransition(() => {
      router.replace(`/admin/customers?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        Filtr tagem:
      </span>
      {tags.map((tag) => {
        const isActive = tag === activeTag;
        return (
          <button
            key={tag}
            type="button"
            disabled={isPending}
            onClick={() => setTag(isActive ? null : tag)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/50 text-foreground hover:bg-muted"
            }`}
          >
            {tag}
          </button>
        );
      })}
      {activeTag && !tags.includes(activeTag) && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => setTag(null)}
          className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-2.5 py-1 text-xs text-primary-foreground"
        >
          {activeTag}
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
