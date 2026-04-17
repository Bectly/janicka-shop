"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile, type UpdateProfileState } from "./actions";

interface Props {
  initial: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    street: string;
    city: string;
    zip: string;
  };
}

const INITIAL_STATE: UpdateProfileState = { error: null, success: false };

export function ProfileForm({ initial }: Props) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL_STATE);

  return (
    <form action={action} className="space-y-6 rounded-xl border bg-card p-6 shadow-sm">
      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Přihlašovací údaje
        </legend>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            defaultValue={initial.email}
            disabled
            autoComplete="email"
          />
          <p className="text-xs text-muted-foreground">
            Email slouží jako přihlašovací jméno a nelze jej změnit.
          </p>
        </div>
      </fieldset>

      <hr className="border-border" />

      <fieldset className="space-y-4">
        <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Kontaktní údaje
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">Jméno</Label>
            <Input
              id="firstName"
              name="firstName"
              defaultValue={initial.firstName}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Příjmení</Label>
            <Input
              id="lastName"
              name="lastName"
              defaultValue={initial.lastName}
              required
              autoComplete="family-name"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={initial.phone}
            autoComplete="tel"
            placeholder="+420 ..."
          />
        </div>
        {/* Hidden legacy fields — persist existing single-address data until cleanup task */}
        <input type="hidden" name="street" value={initial.street} />
        <input type="hidden" name="city" value={initial.city} />
        <input type="hidden" name="zip" value={initial.zip} />
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-sage-dark">
          Profil byl uložen.
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Ukládám…" : "Uložit změny"}
        </Button>
      </div>
    </form>
  );
}
