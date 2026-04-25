"use client";

import { useState, useTransition } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MessageSquare, Send, Loader2, AlertCircle } from "lucide-react";
import { addCommentAction } from "@/app/(admin)/admin/manager/actions";

type Comment = {
  id: string;
  authorRole: string;
  authorName: string | null;
  bodyMd: string;
  createdAt: Date | string;
};

const ROLE_LABEL: Record<string, string> = {
  "shop owner": "Janička",
  bectly: "bectly",
  manager: "Manažerka",
  system: "Systém",
};

const ROLE_BADGE: Record<string, string> = {
  "shop owner": "bg-emerald-500/10 text-emerald-700",
  bectly: "bg-amber-500/10 text-amber-700",
  manager: "bg-primary/10 text-primary",
  system: "bg-foreground/[0.06] text-muted-foreground",
};

function formatCest(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(date);
}

export function CommentThread({
  parentType,
  parentId,
  comments,
}: {
  parentType: "task" | "artifact" | "session";
  parentId: string;
  comments: Comment[];
}) {
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(comments.length === 0);

  const handleSubmit = () => {
    setError(null);
    if (!draft.trim()) return;
    startTransition(async () => {
      const r = await addCommentAction(parentType, parentId, draft);
      if (!r.ok) {
        setError(r.error ?? "Chyba");
      } else {
        setDraft("");
      }
    });
  };

  return (
    <div className="space-y-2 border-t pt-2 mt-2">
      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((c) => (
            <div
              key={c.id}
              className="rounded-md bg-foreground/[0.03] p-2 text-xs space-y-1"
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide">
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    ROLE_BADGE[c.authorRole] ?? "bg-foreground/[0.06]"
                  }`}
                >
                  {c.authorName || ROLE_LABEL[c.authorRole] || c.authorRole}
                </span>
                <span className="text-muted-foreground">
                  {formatCest(c.createdAt)}
                </span>
              </div>
              <div className="prose prose-sm max-w-none text-foreground/90">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {c.bodyMd}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <MessageSquare className="size-3" />
          Přidat poznámku
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 4000))}
            placeholder="Tvoje poznámka, otázka, kontext…"
            disabled={isPending}
            className="w-full resize-none rounded-md border bg-background p-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {draft.length}/4000
            </span>
            <div className="flex gap-1">
              {comments.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setDraft("");
                    setError(null);
                  }}
                  disabled={isPending}
                  className="rounded-md border px-2 py-1 text-xs hover:bg-foreground/5 disabled:opacity-50"
                >
                  Zavřít
                </button>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || !draft.trim()}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-3 animate-spin" /> Posílám
                  </>
                ) : (
                  <>
                    <Send className="size-3" /> Poslat
                  </>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="flex items-start gap-1 rounded-md bg-red-500/10 p-1.5 text-xs text-red-700">
              <AlertCircle className="size-3 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
