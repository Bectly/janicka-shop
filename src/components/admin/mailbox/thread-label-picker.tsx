"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  listLabelsAction,
  setThreadLabelsAction,
  type LabelRow,
} from "@/app/(admin)/admin/mailbox/actions";

export type ThreadLabelChip = {
  id: string;
  name: string;
  color: string;
};

export function ThreadLabelPicker({
  threadId,
  initialLabels,
}: {
  threadId: string;
  initialLabels: ThreadLabelChip[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const initialIds = useMemo(
    () => new Set(initialLabels.map((l) => l.id)),
    [initialLabels],
  );
  const [selected, setSelected] = useState<Set<string>>(initialIds);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(initialIds));
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
  }, [open, initialIds]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      try {
        await setThreadLabelsAction(threadId, Array.from(selected));
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Uložení selhalo.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {initialLabels.map((l) => (
        <span
          key={l.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            backgroundColor: `${l.color}20`,
            color: l.color,
          }}
        >
          <span
            aria-hidden
            className="size-1.5 rounded-full"
            style={{ backgroundColor: l.color }}
          />
          {l.name}
        </span>
      ))}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
              aria-label="Štítky konverzace"
            >
              <Tag className="size-3" />
              Štítky
            </button>
          }
        />
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Štítky konverzace</DialogTitle>
          </DialogHeader>

          <div className="-mx-4 max-h-72 overflow-y-auto border-y">
            {labels.length === 0 ? (
              <p className="p-4 text-center text-xs text-muted-foreground">
                Zatím žádné štítky. Vytvoř je v sidebaru schránky.
              </p>
            ) : (
              <ul className="divide-y">
                {labels.map((l) => {
                  const checked = selected.has(l.id);
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => toggle(l.id)}
                        aria-pressed={checked}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/50"
                      >
                        <span
                          aria-hidden
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: l.color }}
                        />
                        <span className="flex-1 truncate text-sm">{l.name}</span>
                        {checked ? (
                          <Check className="size-4 text-primary" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {error ? (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Zrušit
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={pending}
            >
              Uložit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
