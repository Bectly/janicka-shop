"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateEmailPreferences, deleteAccount } from "./actions";

interface Props {
  email: string;
  initial: { notifyMarketing: boolean };
}

const INITIAL = { error: null as string | null, success: false };

export function SettingsForm({ email, initial }: Props) {
  const [prefsState, prefsAction, prefsPending] = useActionState(
    updateEmailPreferences,
    INITIAL,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteAccount,
    INITIAL,
  );
  const [showDelete, setShowDelete] = useState(false);
  const router = useRouter();

  if (deleteState.success) {
    queueMicrotask(() => {
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form
        action={prefsAction}
        className="space-y-4 rounded-xl border bg-card p-6 shadow-sm"
      >
        <div>
          <h3 className="font-heading text-lg font-semibold">Emailové notifikace</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Rozhoduj, co ti máme posílat.
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex cursor-not-allowed items-start gap-3 rounded-lg border bg-muted/30 p-3 opacity-70">
            <input
              type="checkbox"
              checked
              disabled
              className="mt-0.5 size-4 rounded border-input accent-primary"
              aria-describedby="trans-hint"
            />
            <div className="flex-1">
              <span className="text-sm font-medium">Aktualizace objednávek</span>
              <p id="trans-hint" className="mt-0.5 text-xs text-muted-foreground">
                Nezbytné pro vyřízení objednávek — nelze vypnout.
              </p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:bg-muted/40">
            <input
              type="checkbox"
              name="notifyMarketing"
              defaultChecked={initial.notifyMarketing}
              className="mt-0.5 size-4 cursor-pointer rounded border-input accent-primary"
            />
            <div className="flex-1">
              <span className="text-sm font-medium">Slevy a akce, nové kousky</span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Občasný newsletter — slevy, nové kousky v tvé velikosti, kampaně.
              </p>
            </div>
          </label>
        </div>

        {prefsState.error && (
          <p role="alert" className="text-sm text-destructive">
            {prefsState.error}
          </p>
        )}
        {prefsState.success && (
          <p role="status" className="text-sm text-sage-dark">
            Uloženo.
          </p>
        )}

        <Button type="submit" disabled={prefsPending}>
          {prefsPending ? "Ukládám…" : "Uložit preference"}
        </Button>
      </form>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h3 className="font-heading text-lg font-semibold">Tvoje data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Podle GDPR máš nárok na export všech uložených údajů.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            window.location.href = "/api/account/export";
          }}
        >
          Stáhnout moje data
        </Button>
      </div>

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-start gap-3">
          <Trash2 className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h3 className="font-heading text-lg font-semibold text-destructive">
              Smazat účet
            </h3>
            <p className="mt-1 text-sm text-foreground/80">
              Tvoje osobní údaje budou anonymizovány. Historie objednávek zůstává
              uchována 10 let podle zákona o účetnictví — bez tvých osobních údajů.
            </p>

            {!showDelete ? (
              <Button
                variant="destructive"
                className="mt-4"
                onClick={() => setShowDelete(true)}
              >
                Smazat účet
              </Button>
            ) : (
              <form action={deleteAction} className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="confirmEmail">
                    Pro potvrzení napiš svůj email: <strong>{email}</strong>
                  </Label>
                  <Input
                    id="confirmEmail"
                    name="confirmEmail"
                    type="email"
                    required
                    autoComplete="off"
                    placeholder={email}
                  />
                </div>
                {deleteState.error && (
                  <p role="alert" className="text-sm text-destructive">
                    {deleteState.error}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={deletePending}
                  >
                    {deletePending ? "Mažu…" : "Ano, smazat trvale"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDelete(false)}
                    disabled={deletePending}
                  >
                    Zrušit
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
