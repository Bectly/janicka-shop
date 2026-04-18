"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Eye, EyeOff, Star, StarOff, Pencil, Check, X } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { updateProductQuick } from "@/app/(admin)/admin/products/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TogglesProps = {
  id: string;
  active: boolean;
  featured: boolean;
  sold: boolean;
};

export function InlinePriceEdit({
  id,
  price: initial,
  onChange,
}: {
  id: string;
  price: number;
  onChange?: (next: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(initial);
  const [draft, setDraft] = useState(String(initial));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setPrice(initial), [initial]);
  useEffect(() => {
    if (editing) {
      setDraft(String(price));
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [editing, price]);

  function save() {
    const n = parseFloat(draft.replace(",", "."));
    if (!isFinite(n) || n <= 0) {
      setError("Neplatná cena");
      return;
    }
    if (n === price) {
      setEditing(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await updateProductQuick(id, { price: n });
        setPrice(res.product.price);
        onChange?.(res.product.price);
        setEditing(false);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Chyba");
      }
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium transition-colors duration-150 hover:bg-muted"
        title="Kliknutím uprav cenu"
      >
        {formatPrice(price)}
        <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
      </button>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step="1"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setEditing(false);
            setError(null);
          }
        }}
        disabled={isPending}
        className="h-7 w-24 text-right text-sm"
      />
      <Button
        type="button"
        size="icon"
        onClick={save}
        disabled={isPending}
        className="size-7 bg-primary hover:bg-primary/90"
        aria-label="Uložit"
      >
        <Check className="size-3" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
        disabled={isPending}
        className="size-7"
        aria-label="Zrušit"
      >
        <X className="size-3" />
      </Button>
      {error && (
        <span className="ml-1 text-[10px] text-destructive">{error}</span>
      )}
    </div>
  );
}

export function ProductQuickToggles({ id, active, featured, sold }: TogglesProps) {
  const [state, setState] = useState({ active, featured });
  const [isPending, startTransition] = useTransition();

  useEffect(() => setState({ active, featured }), [active, featured]);

  function toggle(key: "active" | "featured") {
    const next = !state[key];
    setState((s) => ({ ...s, [key]: next }));
    startTransition(async () => {
      try {
        await updateProductQuick(id, { [key]: next });
      } catch {
        setState((s) => ({ ...s, [key]: !next }));
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => toggle("active")}
        disabled={isPending || sold}
        title={sold ? "Prodáno" : state.active ? "Aktivní — klikni pro skrytí" : "Skryto — klikni pro aktivaci"}
        className={`rounded p-1 transition-colors duration-150 hover:bg-muted disabled:opacity-40 ${
          state.active ? "text-emerald-600" : "text-muted-foreground"
        }`}
        aria-label={state.active ? "Skrýt" : "Aktivovat"}
      >
        {state.active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
      <button
        type="button"
        onClick={() => toggle("featured")}
        disabled={isPending}
        title={state.featured ? "Featured — klikni pro odebrání" : "Přidat do featured"}
        className={`rounded p-1 transition-colors duration-150 hover:bg-muted disabled:opacity-50 ${
          state.featured ? "text-amber-500" : "text-muted-foreground"
        }`}
        aria-label={state.featured ? "Odebrat z featured" : "Přidat do featured"}
      >
        {state.featured ? (
          <Star className="size-4 fill-current" />
        ) : (
          <StarOff className="size-4" />
        )}
      </button>
    </div>
  );
}
