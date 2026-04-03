"use client";

import { useActionState } from "react";
import { subscribeNewsletter } from "@/app/(shop)/actions";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export function NewsletterForm() {
  const [state, action, isPending] = useActionState(subscribeNewsletter, null);

  if (state?.success) {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600">
        <CheckCircle2 className="size-5" />
        <span>{state.message}</span>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <form action={action} className="flex gap-2">
        <input
          type="email"
          name="email"
          placeholder="váš@email.cz"
          className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          required
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Odesílám..." : "Odebírat"}
        </Button>
      </form>
      {state && !state.success && (
        <p className="mt-2 text-xs text-destructive">{state.message}</p>
      )}
    </div>
  );
}
