"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BellRing, Check } from "lucide-react";
import {
  requestBackInStock,
  type BackInStockState,
} from "@/app/(shop)/products/[slug]/back-in-stock-actions";
import { CONDITION_LABELS } from "@/lib/constants";

interface BackInStockFormProps {
  categoryId: string;
  brand: string | null;
  size: string | null;
  condition: string | null;
  sourceProductId: string;
}

const initialState: BackInStockState = { success: false, error: null };

export function BackInStockForm({
  categoryId,
  brand,
  size,
  condition,
  sourceProductId,
}: BackInStockFormProps) {
  const [state, action, isPending] = useActionState(
    requestBackInStock,
    initialState,
  );

  if (state.success) {
    return (
      <div className="mt-4 rounded-xl border border-sage bg-sage-light p-4 text-center dark:border-sage-dark dark:bg-sage-dark/20">
        <Check className="mx-auto size-6 animate-scale-in text-sage-dark dark:text-sage" />
        <p className="mt-2 text-sm font-medium text-sage-dark dark:text-sage">
          Super! Budeme hlídat za tebe.
        </p>
        <p className="mt-1 text-xs text-sage-dark/80 dark:text-sage/70">
          Jakmile přidáme kousek se stejnými parametry, pošleme ti email.
        </p>
      </div>
    );
  }

  const conditionLabel = condition ? CONDITION_LABELS[condition] ?? condition : null;
  const parts = [brand, size, conditionLabel].filter(Boolean) as string[];
  const summary = parts.length > 0 ? parts.join(" · ") : "stejná kategorie";

  return (
    <div
      data-testid="back-in-stock-form"
      className="mt-4 rounded-xl border border-primary/15 bg-primary/[0.03] p-4"
    >
      <div className="flex items-center gap-2">
        <BellRing className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Hlídat přesně tenhle typ
        </h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Dám ti vědět, až přidám jiný kousek: {summary}.
      </p>

      <form action={action} className="mt-3 flex gap-2">
        <input type="hidden" name="categoryId" value={categoryId} />
        {brand && <input type="hidden" name="brand" value={brand} />}
        {size && <input type="hidden" name="size" value={size} />}
        {condition && <input type="hidden" name="condition" value={condition} />}
        <input type="hidden" name="sourceProductId" value={sourceProductId} />
        <Input
          type="email"
          name="email"
          placeholder="váš@email.cz"
          required
          autoComplete="email"
          className="h-9 min-w-0 flex-1 text-sm"
        />
        <Button type="submit" size="sm" disabled={isPending} className="shrink-0">
          {isPending ? "Odesílám…" : "Hlídat"}
        </Button>
      </form>

      {state.error && (
        <p className="mt-2 text-xs text-destructive">{state.error}</p>
      )}
    </div>
  );
}
