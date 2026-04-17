"use client";

import { useState, useTransition } from "react";
import { updateCustomerProfile } from "../actions";
import { Pencil, Loader2, Check, X } from "lucide-react";

type Props = {
  customerId: string;
  initial: {
    firstName: string;
    lastName: string;
    phone: string | null;
    street: string | null;
    city: string | null;
    zip: string | null;
    country: string;
  };
};

export function CustomerProfileEditor({ customerId, initial }: Props) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initial);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateCustomerProfile(customerId, form);
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Uložení selhalo.");
      }
    });
  }

  function cancel() {
    setForm(initial);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Profil
          </h3>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            <Pencil className="size-3.5" />
            Upravit
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Jméno</dt>
            <dd className="text-foreground">
              {initial.firstName} {initial.lastName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Telefon</dt>
            <dd className="text-foreground">{initial.phone ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Výchozí adresa</dt>
            <dd className="text-foreground">
              {initial.street
                ? `${initial.street}, ${initial.zip ?? ""} ${initial.city ?? ""}${initial.country ? ` (${initial.country})` : ""}`
                : "—"}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const input =
    "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="font-heading text-sm font-semibold text-foreground">
        Upravit profil
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          Jméno *
          <input
            className={`mt-1 ${input}`}
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Příjmení *
          <input
            className={`mt-1 ${input}`}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-2">
          Telefon
          <input
            className={`mt-1 ${input}`}
            value={form.phone ?? ""}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-2">
          Ulice
          <input
            className={`mt-1 ${input}`}
            value={form.street ?? ""}
            onChange={(e) => setForm({ ...form, street: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          PSČ
          <input
            className={`mt-1 ${input}`}
            value={form.zip ?? ""}
            onChange={(e) => setForm({ ...form, zip: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Město
          <input
            className={`mt-1 ${input}`}
            value={form.city ?? ""}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Země (ISO)
          <input
            className={`mt-1 ${input}`}
            maxLength={2}
            value={form.country ?? ""}
            onChange={(e) =>
              setForm({ ...form, country: e.target.value.toUpperCase() })
            }
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
          Uložit
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          <X className="size-3.5" />
          Zrušit
        </button>
      </div>
    </div>
  );
}
