"use client";

import { useEffect, useState, useTransition } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createLabelAction,
  deleteLabelAction,
  listLabelsAction,
  updateLabelAction,
  type LabelRow,
} from "@/app/(admin)/admin/mailbox/actions";

const PRESET_COLORS = [
  "#9CA3AF", // gray
  "#EF4444", // red
  "#F59E0B", // amber
  "#10B981", // emerald
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#14B8A6", // teal
];

type EditState = {
  id?: string;
  name: string;
  color: string;
};

const EMPTY: EditState = { name: "", color: PRESET_COLORS[0] };

export function MailboxLabelManager() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [edit, setEdit] = useState<EditState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listLabelsAction();
        if (!cancelled) setLabels(rows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Načtení selhalo.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function refresh() {
    listLabelsAction()
      .then(setLabels)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Načtení selhalo."),
      );
    router.refresh();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = edit.name.trim();
    if (!name) {
      setError("Zadej název štítku.");
      return;
    }
    startTransition(async () => {
      try {
        if (edit.id) {
          await updateLabelAction({ id: edit.id, name, color: edit.color });
        } else {
          await createLabelAction({ name, color: edit.color });
        }
        setEdit(EMPTY);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Uložení selhalo.");
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm("Smazat štítek? Odstraní se i přiřazení ke všem konverzacím.")) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteLabelAction(id);
        if (edit.id === id) setEdit(EMPTY);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Smazání selhalo.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Spravovat štítky"
          >
            <Tag className="size-3.5" />
            Spravovat štítky
          </button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Štítky schránky</DialogTitle>
          <DialogDescription>
            Vytvoř, přejmenuj nebo smaž štítky používané ke kategorizaci konverzací.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              value={edit.name}
              onChange={(e) =>
                setEdit((s) => ({ ...s, name: e.target.value }))
              }
              placeholder={edit.id ? "Přejmenovat štítek" : "Nový štítek"}
              maxLength={60}
              aria-label="Název štítku"
            />
            <Button type="submit" disabled={pending} size="sm">
              {edit.id ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
              {edit.id ? "Uložit" : "Přidat"}
            </Button>
            {edit.id ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEdit(EMPTY)}
                disabled={pending}
              >
                Zrušit
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEdit((s) => ({ ...s, color: c }))}
                aria-label={`Barva ${c}`}
                aria-pressed={edit.color === c}
                className={`size-6 rounded-full border-2 transition-all ${
                  edit.color === c
                    ? "scale-110 border-foreground"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <div className="-mx-4 max-h-72 overflow-y-auto border-t">
          {labels.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              Zatím žádné štítky.
            </p>
          ) : (
            <ul className="divide-y">
              {labels.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center gap-3 px-4 py-2"
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="flex-1 truncate text-sm">{l.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setEdit({ id: l.id, name: l.name, color: l.color })
                    }
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Upravit ${l.name}`}
                    disabled={pending}
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(l.id)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Smazat ${l.name}`}
                    disabled={pending}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
