"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteSignatureAction,
  listSignaturesAction,
  upsertSignatureAction,
  type SignatureRow,
} from "../actions";

type EditState = {
  id?: string;
  alias: string;
  bodyHtml: string;
  isDefault: boolean;
};

export function SignatureManager({
  aliases,
  initial,
}: {
  aliases: string[];
  initial: SignatureRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SignatureRow[]>(initial);
  const defaultAlias = aliases[0] ?? "";
  const [edit, setEdit] = useState<EditState>({
    alias: defaultAlias,
    bodyHtml: "",
    isDefault: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    listSignaturesAction()
      .then(setRows)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Načtení selhalo."),
      );
    router.refresh();
  }

  function reset() {
    setEdit({ alias: defaultAlias, bodyHtml: "", isDefault: false });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!edit.alias.trim()) {
      setError("Vyber alias.");
      return;
    }
    if (!edit.bodyHtml.trim()) {
      setError("Tělo podpisu je povinné.");
      return;
    }
    startTransition(async () => {
      try {
        await upsertSignatureAction({
          id: edit.id,
          alias: edit.alias,
          bodyHtml: edit.bodyHtml,
          isDefault: edit.isDefault,
        });
        reset();
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Uložení selhalo.");
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm("Smazat tento podpis?")) return;
    startTransition(async () => {
      try {
        await deleteSignatureAction(id);
        if (edit.id === id) reset();
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Smazání selhalo.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-xl border bg-card p-4 shadow-sm"
        data-testid="signature-form"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Alias</span>
            <select
              value={edit.alias}
              onChange={(e) =>
                setEdit((s) => ({ ...s, alias: e.target.value }))
              }
              disabled={pending || Boolean(edit.id)}
              className="mt-1 block w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {aliases.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              type="checkbox"
              checked={edit.isDefault}
              onChange={(e) =>
                setEdit((s) => ({ ...s, isDefault: e.target.checked }))
              }
              disabled={pending}
              className="size-4 rounded border-muted-foreground/40"
            />
            <span className="text-muted-foreground">
              Použít jako výchozí pro tento alias
            </span>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">
            Podpis (HTML)
          </span>
          <textarea
            value={edit.bodyHtml}
            onChange={(e) =>
              setEdit((s) => ({ ...s, bodyHtml: e.target.value }))
            }
            rows={6}
            placeholder="<p>S pozdravem,<br />Janička</p>"
            className="mt-1 block w-full rounded-lg border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            disabled={pending}
            data-testid="signature-body"
          />
        </label>
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {edit.id ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
            {edit.id ? "Uložit změny" : "Přidat podpis"}
          </button>
          {edit.id ? (
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Zrušit
            </button>
          ) : null}
        </div>
      </form>

      <div className="rounded-xl border bg-card shadow-sm">
        {rows.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            Zatím žádné podpisy.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((s) => (
              <li key={s.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold">{s.alias}</span>
                    {s.isDefault ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase text-primary">
                        výchozí
                      </span>
                    ) : null}
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                    {s.bodyHtml}
                  </pre>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEdit({
                        id: s.id,
                        alias: s.alias,
                        bodyHtml: s.bodyHtml,
                        isDefault: s.isDefault,
                      })
                    }
                    className="rounded p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Upravit ${s.alias}`}
                    disabled={pending}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(s.id)}
                    className="rounded p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Smazat ${s.alias}`}
                    disabled={pending}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
