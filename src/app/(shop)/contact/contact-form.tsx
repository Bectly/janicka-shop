"use client";

import { useActionState } from "react";
import { submitContactForm } from "./actions";
import { CheckCircle, Loader2 } from "lucide-react";

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContactForm, null);

  if (state?.success) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle className="size-10 text-sage" />
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Zpráva odeslána
          </h2>
          <p className="text-sm text-muted-foreground">
            Děkujeme za vaši zprávu! Odpovíme vám co nejdříve, obvykle do 24
            hodin v pracovní dny.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Napište nám
      </h2>
      <form action={formAction} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-foreground"
          >
            Jméno
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            maxLength={100}
            className="mt-1 min-h-[44px] w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Vaše jméno"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground"
          >
            E-mail
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            maxLength={200}
            className="mt-1 min-h-[44px] w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="vas@email.cz"
          />
        </div>

        <div>
          <label
            htmlFor="subject"
            className="block text-sm font-medium text-foreground"
          >
            Předmět
          </label>
          <select
            id="subject"
            name="subject"
            className="mt-1 min-h-[44px] w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="order">Dotaz k objednávce</option>
            <option value="product">Dotaz k produktu</option>
            <option value="shipping">Doprava</option>
            <option value="return">Vrácení / reklamace</option>
            <option value="other">Jiné</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="message"
            className="block text-sm font-medium text-foreground"
          >
            Zpráva
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            required
            minLength={10}
            maxLength={5000}
            className="mt-1 min-h-[44px] w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Jak vám můžeme pomoci?"
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending ? "Odesílám…" : "Odeslat zprávu"}
        </button>
        <p className="text-xs text-muted-foreground">
          Odesláním formuláře souhlasíte se zpracováním osobních údajů za účelem
          vyřízení vašeho dotazu.
        </p>
      </form>
    </div>
  );
}
