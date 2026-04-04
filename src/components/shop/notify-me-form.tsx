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
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
        <Check className="mx-auto size-6 text-emerald-600 dark:text-emerald-400" />
        <p className="mt-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          Super! Dáme vám vědět.
        </p>
        <p className="mt-1 text-xs text-emerald-600/80 dark:text-emerald-400/70">
          Jakmile přidáme podobný kousek z kategorie {categoryName}, pošleme vám email.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border bg-card p-4">
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
          className="h-9 text-sm"
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
