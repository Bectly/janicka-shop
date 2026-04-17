"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestEmailChange, type ChangeEmailState } from "./actions";

const INITIAL: ChangeEmailState = { error: null, success: false };

export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, action, pending] = useActionState(requestEmailChange, INITIAL);

  if (state.success) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 shadow-sm">
        <h3 className="font-heading text-lg font-semibold">Zkontroluj svou schránku</h3>
        <p className="mt-2 text-sm text-foreground/80">
          Poslali jsme ověřovací odkaz na <strong>{state.pending}</strong>. Klikni na něj
          do 1 hodiny — teprve pak se email přepne. Do té doby se přihlašuješ původní
          adresou <strong>{currentEmail}</strong>.
        </p>
        <Link
          href="/account/profile"
          className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
        >
          Zpět na profil
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
    >
      <div className="space-y-2">
        <Label>Aktuální email</Label>
        <Input value={currentEmail} readOnly disabled />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newEmail">Nový email</Label>
        <Input
          id="newEmail"
          name="newEmail"
          type="email"
          required
          autoComplete="email"
          placeholder="novy@email.cz"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Aktuální heslo</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
        <p className="text-xs text-muted-foreground">
          Pro bezpečnost změnu potvrzujeme heslem.
        </p>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Odesílám…" : "Poslat ověření"}
        </Button>
        <Link href="/account/profile" className={buttonVariants({ variant: "outline" })}>
          Zrušit
        </Link>
      </div>
    </form>
  );
}
