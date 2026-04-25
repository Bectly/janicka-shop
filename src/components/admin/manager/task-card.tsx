"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Loader2,
  Play,
  RotateCcw,
  XCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptTaskAction,
  completeTaskAction,
  rejectTaskAction,
  reopenTaskAction,
  startTaskAction,
} from "@/app/(admin)/admin/manager/actions";
import type { HumanTask } from "@/lib/jarvis-db";

import {
  CATEGORY_CLASSES,
  CATEGORY_LABELS,
  PRIORITY_CLASSES,
  PRIORITY_LABELS,
  formatCzDate,
  formatCzDueDate,
  previewText,
} from "./task-meta";

type Mode = "idle" | "complete" | "reject";

export function TaskCard({ task }: { task: HumanTask }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
    });
  }

  function handleComplete() {
    run(async () => {
      await completeTaskAction(task.id, notes.trim() || undefined);
      setMode("idle");
      setNotes("");
      setOpen(false);
    });
  }

  function handleReject() {
    run(async () => {
      await rejectTaskAction(task.id, notes.trim() || undefined);
      setMode("idle");
      setNotes("");
      setOpen(false);
    });
  }

  return (
    <>
      <article className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight text-foreground">
            {task.title}
          </h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_CLASSES[task.priority]}`}
          >
            {PRIORITY_LABELS[task.priority]}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_CLASSES[task.category]}`}
          >
            {CATEGORY_LABELS[task.category]}
          </span>
          {task.due_at ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="size-3" />
              Termín: {formatCzDueDate(task.due_at)}
            </span>
          ) : null}
          {task.assignee_hint ? (
            <span className="text-[11px] text-muted-foreground">
              Pro: {task.assignee_hint}
            </span>
          ) : null}
        </div>
        {task.description_md ? (
          <p className="line-clamp-3 text-xs text-muted-foreground">
            {previewText(task.description_md, 200)}
          </p>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
          >
            Detail
          </Button>
          {renderActionButtons(task, pending, run)}
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{task.title}</DialogTitle>
            <DialogDescription>
              <span
                className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${CATEGORY_CLASSES[task.category]}`}
              >
                {CATEGORY_LABELS[task.category]}
              </span>
              <span
                className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_CLASSES[task.priority]}`}
              >
                {PRIORITY_LABELS[task.priority]}
              </span>
              <span className="text-xs text-muted-foreground">
                Vytvořeno {formatCzDate(task.created_at)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {task.due_at ? (
              <p className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm">
                <Calendar className="size-4" />
                Termín: <strong>{formatCzDueDate(task.due_at)}</strong>
              </p>
            ) : null}

            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Popis
              </h4>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {task.description_md}
                </ReactMarkdown>
              </div>
            </section>

            {task.rationale_md ? (
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Proč
                </h4>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {task.rationale_md}
                  </ReactMarkdown>
                </div>
              </section>
            ) : null}

            {task.expected_outcome ? (
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Očekávaný výsledek
                </h4>
                <p className="text-sm">{task.expected_outcome}</p>
              </section>
            ) : null}

            {task.completion_notes ? (
              <section>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Poznámky k dokončení
                </h4>
                <p className="text-sm">{task.completion_notes}</p>
              </section>
            ) : null}

            {mode !== "idle" ? (
              <section className="rounded-md border bg-muted/40 p-3">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {mode === "complete"
                    ? "Poznámka k dokončení (volitelné)"
                    : "Důvod zamítnutí (volitelné)"}
                </h4>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={
                    mode === "complete"
                      ? "Co se podařilo, čeho jsi dosáhla…"
                      : "Proč to nedává smysl udělat…"
                  }
                />
              </section>
            ) : null}
          </div>

          <DialogFooter className="flex flex-wrap justify-end gap-2">
            {mode === "idle" ? (
              <>
                {renderActionButtons(task, pending, run, true)}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Zavřít
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMode("idle");
                    setNotes("");
                  }}
                  disabled={pending}
                >
                  Zpět
                </Button>
                {mode === "complete" ? (
                  <Button
                    type="button"
                    onClick={handleComplete}
                    disabled={pending}
                    className="gap-2"
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4" />
                    )}
                    Označit jako hotové
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={pending}
                    className="gap-2"
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <XCircle className="size-4" />
                    )}
                    Zamítnout
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  function renderActionButtons(
    t: HumanTask,
    isPending: boolean,
    runFn: (a: () => Promise<void>) => void,
    inDialog = false,
  ) {
    if (t.status === "open") {
      return (
        <>
          <Button
            type="button"
            size="sm"
            onClick={() => runFn(async () => acceptTaskAction(t.id))}
            disabled={isPending}
            className="gap-1"
          >
            <CheckCircle2 className="size-3.5" />
            Přijmout
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (!inDialog) setOpen(true);
              setMode("reject");
            }}
            disabled={isPending}
            className="gap-1"
          >
            <XCircle className="size-3.5" />
            Zamítnout
          </Button>
        </>
      );
    }
    if (t.status === "accepted") {
      return (
        <>
          <Button
            type="button"
            size="sm"
            onClick={() => runFn(async () => startTaskAction(t.id))}
            disabled={isPending}
            className="gap-1"
          >
            <Play className="size-3.5" />
            Začít pracovat
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => runFn(async () => reopenTaskAction(t.id))}
            disabled={isPending}
            className="gap-1"
          >
            <RotateCcw className="size-3.5" />
            Zpět
          </Button>
        </>
      );
    }
    if (t.status === "in_progress") {
      return (
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (!inDialog) setOpen(true);
            setMode("complete");
          }}
          disabled={isPending}
          className="gap-1"
        >
          <CheckCircle2 className="size-3.5" />
          Hotovo
        </Button>
      );
    }
    if (t.status === "blocked") {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="size-3.5" />
          Zablokováno
        </span>
      );
    }
    return null;
  }
}
