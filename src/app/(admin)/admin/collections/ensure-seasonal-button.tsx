"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export function EnsureSeasonalButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/ensure-seasonal-collections", {
          method: "POST",
        });
        const data = (await res.json()) as {
          ok?: boolean;
          results?: Array<{ slug: string; action: "created" | "exists" }>;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          setMsg(data.error ?? "Chyba při vytváření sezónních kolekcí");
          return;
        }
        const created = data.results?.filter((r) => r.action === "created") ?? [];
        setMsg(
          created.length > 0
            ? `Vytvořeno: ${created.map((r) => r.slug).join(", ")}`
            : "Všechny sezónní kolekce už existují",
        );
        router.refresh();
      } catch {
        setMsg("Síťová chyba");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="size-4" />
        {pending ? "Vytvářím..." : "Sezónní kolekce"}
      </button>
      {msg && (
        <span className="text-xs text-muted-foreground">{msg}</span>
      )}
    </div>
  );
}
