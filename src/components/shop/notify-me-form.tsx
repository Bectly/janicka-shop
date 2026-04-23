"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Check } from "lucide-react";
import { requestProductNotify, type NotifyState } from "@/app/(shop)/products/[slug]/notify-actions";

interface NotifyMeFormProps {
  categoryId: string;
  sizes: string; // JSON array
  brand: string | null;
  categoryName: string;
}

const initialState: NotifyState = { success: false, error: null };

export function NotifyMeForm({ categoryId, sizes, brand, categoryName }: NotifyMeFormProps) {
  const [state, action, isPending] = useActionState(requestProductNotify, initialState);

  if (state.success) {
    return (
      <div className="mt-6 rounded-xl border border-sage bg-sage-light p-4 text-center dark:border-sage-dark dark:bg-sage-dark/20">
        <Check className="mx-auto size-6 animate-scale-in text-sage-dark dark:text-sage" />
        <p className="mt-2 text-sm font-medium text-sage-dark dark:text-sage">
          Super! Dáme vám vědět.
        </p>
        <p className="mt-1 text-xs text-sage-dark/80 dark:text-sage/70">
          Jakmile přidáme podobný kousek z kategorie {categoryName}, pošleme vám email.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-primary/15 bg-primary/[0.03] p-4">
      <div className="flex items-center gap-2">
        <Bell className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Dejte mi vědět
        </h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Chcete vědět, až přidáme podobný kousek? Nechte nám email.
      </p>

      <form action={action} className="mt-3 flex gap-2">
        <input type="hidden" name="categoryId" value={categoryId} />
        <input type="hidden" name="sizes" value={sizes} />
        {brand && <input type="hidden" name="brand" value={brand} />}
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
