"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAddress,
  updateAddress,
  type AddressFormState,
} from "./actions";

type AddressInput = {
  id?: string;
  label: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
  isDefault: boolean;
};

interface Props {
  initial?: AddressInput;
  onDone?: () => void;
}

const INITIAL_STATE: AddressFormState = { error: null, success: false };

export function AddressForm({ initial, onDone }: Props) {
  const isEdit = Boolean(initial?.id);
  const action = isEdit
    ? updateAddress.bind(null, initial!.id!)
    : createAddress;
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  if (state.success && onDone) {
    queueMicrotask(onDone);
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="space-y-2">
        <Label htmlFor="label">Název adresy</Label>
        <Input
          id="label"
          name="label"
          placeholder="Domov, Práce…"
          defaultValue={initial?.label ?? "Domov"}
          required
          maxLength={40}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">Jméno</Label>
          <Input
            id="firstName"
            name="firstName"
            defaultValue={initial?.firstName ?? ""}
            required
            autoComplete="given-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Příjmení</Label>
          <Input
            id="lastName"
            name="lastName"
            defaultValue={initial?.lastName ?? ""}
            required
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="street">Ulice a číslo</Label>
        <Input
          id="street"
          name="street"
          defaultValue={initial?.street ?? ""}
          required
          autoComplete="street-address"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <div className="space-y-2">
          <Label htmlFor="city">Město</Label>
          <Input
            id="city"
            name="city"
            defaultValue={initial?.city ?? ""}
            required
            autoComplete="address-level2"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">PSČ</Label>
          <Input
            id="zip"
            name="zip"
            defaultValue={initial?.zip ?? ""}
            required
            autoComplete="postal-code"
            placeholder="12345"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <div className="space-y-2">
          <Label htmlFor="country">Země</Label>
          <select
            id="country"
            name="country"
            defaultValue={initial?.country ?? "CZ"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="CZ">Česko</option>
            <option value="SK">Slovensko</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefon (volitelné)</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={initial?.phone ?? ""}
            autoComplete="tel"
            placeholder="+420 ..."
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <input
          id="isDefault"
          name="isDefault"
          type="checkbox"
          defaultChecked={initial?.isDefault ?? false}
          className="size-4 rounded border-input"
        />
        <Label htmlFor="isDefault" className="font-normal">
          Nastavit jako výchozí adresu
        </Label>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Ukládám…" : isEdit ? "Uložit změny" : "Přidat adresu"}
        </Button>
        {onDone && (
          <Button type="button" variant="outline" onClick={onDone}>
            Zrušit
          </Button>
        )}
      </div>
    </form>
  );
}
