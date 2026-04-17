"use client";

import { useState, useTransition } from "react";
import { MapPin, Edit2, Trash2, Star, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddressForm } from "./address-form";
import { deleteAddress, setDefaultAddress } from "./actions";

export type AddressItem = {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
};

interface Props {
  addresses: AddressItem[];
}

export function AddressList({ addresses }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(addresses.length === 0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteAddress(id);
      setConfirmDelete(null);
    });
  }

  function handleSetDefault(id: string) {
    startTransition(async () => {
      await setDefaultAddress(id);
    });
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !adding && (
        <div className="rounded-xl border border-dashed bg-muted/40 p-8 text-center">
          <MapPin className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            Zatím nemáš uloženou žádnou adresu.
          </p>
          <Button className="mt-4" onClick={() => setAdding(true)}>
            <Plus className="mr-1 size-4" />
            Přidat adresu
          </Button>
        </div>
      )}

      {addresses.map((a) => {
        if (editingId === a.id) {
          return (
            <AddressForm
              key={a.id}
              initial={{
                ...a,
                phone: a.phone ?? "",
              }}
              onDone={() => setEditingId(null)}
            />
          );
        }
        return (
          <div
            key={a.id}
            className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{a.label}</span>
                  {a.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <Star className="size-3 fill-current" />
                      Výchozí
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-foreground">
                  {a.firstName} {a.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{a.street}</p>
                <p className="text-sm text-muted-foreground">
                  {a.zip} {a.city}, {a.country}
                </p>
                {a.phone && (
                  <p className="mt-1 text-sm text-muted-foreground">{a.phone}</p>
                )}
              </div>
              <div className="flex flex-col gap-1 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setEditingId(a.id)}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Upravit adresu"
                >
                  <Edit2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(a.id)}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Smazat adresu"
                  disabled={pending}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            {!a.isDefault && (
              <button
                type="button"
                onClick={() => handleSetDefault(a.id)}
                disabled={pending}
                className="mt-3 text-xs text-primary hover:underline disabled:opacity-50"
              >
                Nastavit jako výchozí
              </button>
            )}

            {confirmDelete === a.id && (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-foreground">
                  Opravdu smazat tuto adresu?
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(a.id)}
                    disabled={pending}
                  >
                    Smazat
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDelete(null)}
                    disabled={pending}
                  >
                    Zrušit
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {adding ? (
        <AddressForm onDone={() => setAdding(false)} />
      ) : addresses.length > 0 ? (
        <Button variant="outline" onClick={() => setAdding(true)} className="w-full sm:w-auto">
          <Plus className="mr-1 size-4" />
          Přidat další adresu
        </Button>
      ) : null}
    </div>
  );
}
