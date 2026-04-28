"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Loader2, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThreadMessageBlocks } from "@/components/admin/manager/thread-message-blocks";

type ThreadStatus =
  | "pending"
  | "processing"
  | "answered"
  | "awaiting_user"
  | "closed";

type ThreadListRow = {
  id: string;
  subject: string | null;
  status: ThreadStatus;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  unreadCount: number;
  lastMessageAt: string | null;
};

type Block = Parameters<typeof ThreadMessageBlocks>[0]["blocks"][number];

type ThreadMessage = {
  id: string;
  role: "user" | "manager";
  blocks: Block[];
  imageKeys?: string[];
  readAt?: string | null;
  createdAt: string;
};

type ThreadDetail = {
  id: string;
  subject: string | null;
  status: ThreadStatus;
  createdAt: string;
  updatedAt: string;
  messages: ThreadMessage[];
};

const POLL_INTERVAL_MS = 3000;
const COLLAPSE_AFTER_MS = 24 * 60 * 60 * 1000;

const STATUS_LABEL: Record<ThreadStatus, string> = {
  pending: "Čeká",
  processing: "Zpracovává se",
  answered: "Odpovězeno",
  awaiting_user: "Čeká odpověď",
  closed: "Archivováno",
};

const STATUS_TINT: Record<ThreadStatus, string> = {
  pending: "border-foreground/10 bg-card",
  processing: "border-amber-500/30 bg-amber-500/5",
  answered: "border-pink-500/30 bg-pink-500/5",
  awaiting_user: "border-sky-500/30 bg-sky-500/5",
  closed: "border-foreground/10 bg-card opacity-70",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(d);
}

export function ThreadsTab() {
  const [threads, setThreads] = useState<ThreadListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, ThreadDetail>>({});
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const optimisticRef = useRef<ThreadListRow[]>([]);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/manager/threads", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { threads: ThreadListRow[] };
      // Drop any optimistic rows that now exist in real data (matched by subject+createdAt prefix).
      const realIds = new Set(data.threads.map((t) => t.id));
      optimisticRef.current = optimisticRef.current.filter(
        (o) => !realIds.has(o.id),
      );
      setThreads([...optimisticRef.current, ...data.threads]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Načtení selhalo");
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/manager/threads/${id}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { thread: ThreadDetail };
      setDetail((prev) => ({ ...prev, [id]: data.thread }));
    } catch {
      // silent — polling will retry
    }
  }, []);

  // Initial load + polling for thread list status updates.
  useEffect(() => {
    void loadThreads();
    const t = setInterval(loadThreads, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [loadThreads]);

  // When a thread is open AND its status is pending/processing, poll its detail
  // so the manager reply appears as soon as the watcher writes it.
  useEffect(() => {
    const ids = Array.from(openIds).filter((id) => {
      const t = threads?.find((x) => x.id === id);
      return (
        t && (t.status === "pending" || t.status === "processing" || !detail[id])
      );
    });
    if (ids.length === 0) return;
    let stopped = false;
    const tick = async () => {
      for (const id of ids) {
        if (stopped) return;
        await loadDetail(id);
      }
    };
    void tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [openIds, threads, detail, loadDetail]);

  // Re-fetch detail when a thread list row flips to answered (so user sees the
  // final message blocks even if they hadn't expanded yet — also drives badge).
  useEffect(() => {
    if (!threads) return;
    threads
      .filter((t) => t.status === "answered" && !detail[t.id])
      .slice(0, 5)
      .forEach((t) => void loadDetail(t.id));
  }, [threads, detail, loadDetail]);

  const toggleOpen = useCallback(
    async (id: string) => {
      setOpenIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      // Mark unread manager messages as read when opening.
      const row = threads?.find((t) => t.id === id);
      if (row && row.unreadCount > 0) {
        try {
          await fetch(`/api/admin/manager/threads/${id}/read`, {
            method: "POST",
          });
          void loadThreads();
        } catch {
          // ignore
        }
      }
      if (!detail[id]) {
        void loadDetail(id);
      }
    },
    [threads, detail, loadDetail, loadThreads],
  );

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = composing.trim();
      if (!text || submitting) return;
      setSubmitting(true);

      const optimisticId = `optimistic_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const optimistic: ThreadListRow = {
        id: optimisticId,
        subject: text.slice(0, 80),
        status: "pending",
        createdAt: nowIso,
        updatedAt: nowIso,
        messageCount: 1,
        unreadCount: 0,
        lastMessageAt: nowIso,
      };
      optimisticRef.current = [optimistic, ...optimisticRef.current];
      setThreads((prev) => (prev ? [optimistic, ...prev] : [optimistic]));
      setComposing("");

      try {
        const res = await fetch("/api/admin/manager/threads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ bodyMd: text }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        await loadThreads();
      } catch (err) {
        optimisticRef.current = optimisticRef.current.filter(
          (o) => o.id !== optimisticId,
        );
        setThreads((prev) =>
          prev ? prev.filter((t) => t.id !== optimisticId) : prev,
        );
        setError(err instanceof Error ? err.message : "Odeslání selhalo");
        setComposing(text);
      } finally {
        setSubmitting(false);
      }
    },
    [composing, submitting, loadThreads],
  );

  const isLoading = threads === null;

  return (
    <div className="space-y-5">
      <Composer
        value={composing}
        onChange={setComposing}
        onSubmit={submit}
        submitting={submitting}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Načítám zprávy…
        </div>
      ) : threads && threads.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {threads!.map((t) => (
            <ThreadCard
              key={t.id}
              thread={t}
              detail={detail[t.id]}
              isOpen={openIds.has(t.id)}
              onToggle={() => toggleOpen(t.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Composer({
  value,
  onChange,
  onSubmit,
  submitting,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}) {
  const len = value.length;
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border bg-card p-3 shadow-sm space-y-2"
    >
      <label
        htmlFor="manager-thread-input"
        className="block text-xs font-medium text-muted-foreground"
      >
        Napsat manažerce
      </label>
      <textarea
        id="manager-thread-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Zeptej se na cenu, akci, strategii sortimentu..."
        rows={3}
        maxLength={2000}
        disabled={submitting}
        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            onSubmit(e as unknown as React.FormEvent);
          }
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {len}/2000 · Cmd+Enter
        </span>
        <button
          type="submit"
          disabled={submitting || value.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Odeslat
        </button>
      </div>
    </form>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center space-y-2">
      <MessageSquare className="mx-auto size-8 text-muted-foreground" />
      <p className="font-medium text-sm">Zatím žádný dotaz na manažerku.</p>
      <p className="mx-auto max-w-sm text-xs text-muted-foreground">
        Zeptej se na cenu, akci, strategii sortimentu — cokoli co tě napadne.
        Manažerka většinou odpoví do pár minut.
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: ThreadStatus }) {
  const Icon =
    status === "answered"
      ? CheckCircle2
      : status === "processing"
        ? Loader2
        : status === "awaiting_user"
          ? AlertCircle
          : Clock;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        status === "answered"
          ? "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300"
          : status === "processing"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : status === "awaiting_user"
              ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
              : "border-foreground/15 bg-foreground/[0.04] text-muted-foreground",
      )}
    >
      <Icon
        className={cn(
          "size-3",
          status === "processing" && "animate-spin",
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function ThreadCard({
  thread,
  detail,
  isOpen,
  onToggle,
}: {
  thread: ThreadListRow;
  detail?: ThreadDetail;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isStale =
    // eslint-disable-next-line react-hooks/purity -- collapse heuristic; updates on poll re-render
    Date.now() - new Date(thread.updatedAt).getTime() > COLLAPSE_AFTER_MS;
  const expanded = isOpen || (!isStale && thread.status !== "closed");

  return (
    <li className={cn("rounded-xl border shadow-sm", STATUS_TINT[thread.status])}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <StatusBadge status={thread.status} />
            {thread.unreadCount > 0 && (
              <span className="rounded-full bg-pink-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {thread.unreadCount} nové
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {formatTime(thread.updatedAt)}
            </span>
          </div>
          <p className="truncate text-sm font-medium">
            {thread.subject || "(bez předmětu)"}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-foreground/10 px-3 py-3">
          {detail ? (
            detail.messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Načítám zprávy…
            </div>
          )}
          {(thread.status === "pending" || thread.status === "processing") && (
            <div className="flex items-center gap-1.5 text-xs italic text-muted-foreground">
              <span className="inline-flex gap-0.5">
                <span className="size-1.5 animate-bounce rounded-full bg-pink-500 [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-pink-500 [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-pink-500" />
              </span>
              Manažerka čte…
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function MessageRow({ message }: { message: ThreadMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2",
        isUser
          ? "border border-foreground/10 bg-background/60"
          : "border border-pink-500/30 bg-pink-500/[0.04]",
      )}
    >
      <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide">
          {isUser ? "Ty" : "Manažerka"}
        </span>
        <span>{formatTime(message.createdAt)}</span>
      </div>
      <ThreadMessageBlocks blocks={message.blocks} />
    </div>
  );
}
