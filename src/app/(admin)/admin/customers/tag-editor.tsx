"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { X, Plus, Loader2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateCustomerTags } from "./actions";

const SUGGESTIONS = ["VIP", "reklamace", "čeká na odpověď", "vrácení", "Instagram"];

export function CustomerTagEditor({
  customerId,
  initialTags,
}: {
  customerId: string;
  initialTags: string[];
}) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function commit(next: string[]) {
    setError(null);
    startTransition(async () => {
      try {
        await updateCustomerTags(customerId, next);
        setTags(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Uložení selhalo");
      }
    });
  }

  function addTag(raw: string) {
    const t = raw.trim().slice(0, 32);
    if (!t) return;
    const key = t.toLocaleLowerCase("cs-CZ");
    if (tags.some((x) => x.toLocaleLowerCase("cs-CZ") === key)) {
      setInput("");
      return;
    }
    if (tags.length >= 20) {
      setError("Maximálně 20 tagů.");
      return;
    }
    commit([...tags, t]);
    setInput("");
  }

  function removeTag(tag: string) {
    commit(tags.filter((x) => x !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      commit(tags.slice(0, -1));
    }
  }

  const availableSuggestions = SUGGESTIONS.filter(
    (s) => !tags.some((t) => t.toLocaleLowerCase("cs-CZ") === s.toLocaleLowerCase("cs-CZ")),
  );

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold text-foreground">
          Tagy
        </h2>
        {isPending && (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Vlastní štítky pro třídění zákaznic (např. VIP, reklamace).
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            {tag}
            <button
              type="button"
              disabled={isPending}
              onClick={() => removeTag(tag)}
              className="rounded-full p-0.5 hover:bg-primary/20"
              aria-label={`Odebrat tag ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <span className="text-xs text-muted-foreground">Žádné tagy.</span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nový tag…"
          maxLength={32}
          disabled={isPending || tags.length >= 20}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => addTag(input)}
          disabled={isPending || !input.trim() || tags.length >= 20}
        >
          <Plus className="size-4" />
          Přidat
        </Button>
      </div>

      {availableSuggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Rychle:</span>
          {availableSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              disabled={isPending || tags.length >= 20}
              className="rounded-full border border-dashed border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
