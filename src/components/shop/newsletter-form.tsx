"use client";

import { useActionState, useEffect, useRef } from "react";
import { subscribeNewsletter } from "@/app/(shop)/actions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { CUSTOMER_EMAIL_KEY } from "@/components/shop/browse-abandonment-tracker";

export function NewsletterForm({ variant = "default" }: { variant?: "default" | "footer" }) {
  const [state, action, isPending] = useActionState(subscribeNewsletter, null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Persist email to localStorage on successful subscription (for browse abandonment tracking)
  useEffect(() => {
    if (state?.success && emailRef.current) {
      try {
        const email = emailRef.current.value.trim().toLowerCase();
        if (email) localStorage.setItem(CUSTOMER_EMAIL_KEY, email);
      } catch { /* localStorage unavailable */ }
    }
  }, [state?.success]);

  if (state?.success) {
    return (
      <div className={`mt-6 flex items-center justify-center gap-2 text-sm font-medium ${variant === "footer" ? "text-sage-light" : "text-sage-dark"}`}>
        <CheckCircle2 className="size-5" />
        <span>{state.message}</span>
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <div className="mt-5">
        <form action={action} className="newsletter-form-footer group relative mx-auto flex max-w-md items-center">
          <label htmlFor="newsletter-email-footer" className="sr-only">Emailová adresa pro odběr novinek</label>
          <input
            ref={emailRef}
            id="newsletter-email-footer"
            type="email"
            name="email"
            placeholder="váš@email.cz"
            autoComplete="email"
            className="newsletter-input-footer w-full rounded-full border border-white/15 bg-white/5 py-3 pl-5 pr-14 text-sm text-white placeholder:text-white/30 outline-none transition-all duration-300 focus:border-brand-light focus:bg-white/10 focus:ring-2 focus:ring-brand-light/20"
            required
          />
          <Button
            type="submit"
            disabled={isPending}
            size="icon"
            className="absolute right-1.5 size-9 rounded-full bg-brand text-white shadow-lg transition-all hover:bg-brand-light hover:shadow-brand/30 disabled:opacity-50"
          >
            {isPending ? (
              <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <ArrowRight className="size-4" />
            )}
          </Button>
        </form>
        {state && !state.success && (
          <p role="alert" className="mt-2 text-center text-xs text-red-400">{state.message}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <form action={action} className="flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">Emailová adresa pro odběr novinek</label>
        <input
          ref={emailRef}
          id="newsletter-email"
          type="email"
          name="email"
          placeholder="váš@email.cz"
          autoComplete="email"
          className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          required
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Odesílám..." : "Odebírat"}
        </Button>
      </form>
      {state && !state.success && (
        <p role="alert" className="mt-2 text-xs text-destructive">{state.message}</p>
      )}
    </div>
  );
}
