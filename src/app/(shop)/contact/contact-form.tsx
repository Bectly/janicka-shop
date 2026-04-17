"use client";

import { useActionState } from "react";
import { submitContactForm } from "./actions";
import { CheckCircle, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
          <Label htmlFor="name">Jméno</Label>
          <Input
            type="text"
            id="name"
            name="name"
            required
            maxLength={100}
            className="mt-1 min-h-[44px]"
            placeholder="Vaše jméno"
          />
        </div>

        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            type="email"
            id="email"
            name="email"
            required
            maxLength={200}
            className="mt-1 min-h-[44px]"
            placeholder="vas@email.cz"
          />
        </div>

        <div>
          <Label htmlFor="subject">Předmět</Label>
          <select
            id="subject"
            name="subject"
            className="mt-1 min-h-[44px] w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <option value="order">Dotaz k objednávce</option>
            <option value="product">Dotaz k produktu</option>
            <option value="shipping">Doprava</option>
            <option value="return">Vrácení / reklamace</option>
            <option value="other">Jiné</option>
          </select>
        </div>

        <div>
          <Label htmlFor="message">Zpráva</Label>
          <Textarea
            id="message"
            name="message"
            rows={4}
            required
            minLength={10}
            maxLength={5000}
            className="mt-1 min-h-[44px]"
            placeholder="Jak vám můžeme pomoci?"
          />
        </div>

        {state?.error && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {isPending ? "Odesílám…" : "Odeslat zprávu"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Odesláním formuláře souhlasíte se zpracováním osobních údajů za účelem
          vyřízení vašeho dotazu.
        </p>
      </form>
    </div>
  );
}
