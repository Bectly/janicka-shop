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
    <form action={action} className="space-y-5 rounded-xl border bg-card p-6 shadow-sm">
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

      <div className="space-y-2">
        <Label htmlFor="street">Ulice a číslo</Label>
        <Input
          id="street"
          name="street"
          defaultValue={initial.street}
          autoComplete="street-address"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div className="space-y-2">
          <Label htmlFor="city">Město</Label>
          <Input
            id="city"
            name="city"
            defaultValue={initial.city}
            autoComplete="address-level2"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">PSČ</Label>
          <Input
            id="zip"
            name="zip"
            defaultValue={initial.zip}
            autoComplete="postal-code"
          />
        </div>
      </div>

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
