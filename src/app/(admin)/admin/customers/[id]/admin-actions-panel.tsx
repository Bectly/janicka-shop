"use client";

import { useState, useTransition } from "react";
import {
  unlockCustomerAccount,
  disableCustomerAccount,
  enableCustomerAccount,
  anonymizeCustomerAccount,
  forceCustomerPasswordReset,
} from "../actions";
import {
  Unlock,
  Ban,
  CheckCircle2,
  Trash2,
  KeyRound,
  Loader2,
} from "lucide-react";

type Props = {
  customerId: string;
  isLocked: boolean;
  isDisabled: boolean;
  isDeleted: boolean;
  hasPassword: boolean;
};

export function AdminActionsPanel({
  customerId,
  isLocked,
  isDisabled,
  isDeleted,
  hasPassword,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function run(fn: () => Promise<void>, successText: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await fn();
        setMessage(successText);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Akce selhala");
      }
    });
  }

  if (isDeleted) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          Admin akce
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Účet byl anonymizován podle GDPR. Další akce nejsou možné.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="font-heading text-sm font-semibold text-foreground">
        Admin akce
      </h3>

      <div className="mt-4 flex flex-wrap gap-2">
        {isLocked && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () => unlockCustomerAccount(customerId),
                "Účet odemknut.",
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            <Unlock className="size-3.5" />
            Odemknout účet
          </button>
        )}

        {hasPassword && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  'Vynutit reset hesla? Zákaznice bude muset použít „Zapomenuté heslo".',
                )
              )
                return;
              run(
                () => forceCustomerPasswordReset(customerId),
                'Heslo resetováno — zákaznice musí použít „Zapomenuté heslo".',
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
          >
            <KeyRound className="size-3.5" />
            Vynutit reset hesla
          </button>
        )}

        {isDisabled ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(
                () => enableCustomerAccount(customerId),
                "Účet aktivován.",
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            <CheckCircle2 className="size-3.5" />
            Aktivovat účet
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt(
                "Důvod pozastavení účtu (nepovinné):",
                "",
              );
              if (reason === null) return;
              run(
                () => disableCustomerAccount(customerId, reason || undefined),
                "Účet pozastaven.",
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
          >
            <Ban className="size-3.5" />
            Pozastavit účet
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                "Anonymizovat účet podle GDPR? Tato akce je nevratná. Objednávky zůstanou zachovány, ale osobní údaje budou odstraněny.",
              )
            )
              return;
            const reason = window.prompt(
              "Důvod anonymizace (nepovinné, ukládá se do poznámek):",
              "",
            );
            if (reason === null) return;
            run(
              () => anonymizeCustomerAccount(customerId, reason || undefined),
              "Účet anonymizován.",
            );
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-60"
        >
          <Trash2 className="size-3.5" />
          GDPR anonymizovat
        </button>

        {pending && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Pracuji...
          </span>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {message && !error && (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {message}
        </p>
      )}
    </div>
  );
}
