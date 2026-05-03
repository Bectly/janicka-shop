"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Loader2,
  Send,
  ImagePlus,
  X,
  Sparkles,
  User2,
  Cog,
  Save,
  CheckCircle2,
  Share2,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { uploadManagerAttachmentAction } from "@/app/(admin)/admin/manager/actions";
import {
  getWorkspaceMessagesAction,
  markTabSeenAction,
  pollNewMessagesAction,
  sendUserMessageAction,
  type WorkspaceMessageRow,
} from "@/app/(admin)/admin/manager/workspace/actions";

const POLL_INTERVAL_MS = 4000;

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

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url);
}

export function WorkspaceChat({
  tabId,
  tabTitle,
  onMessageSent,
}: {
  tabId: string;
  tabTitle: string;
  onMessageSent?: () => void;
}) {
  const [messages, setMessages] = useState<WorkspaceMessageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isSending, startSending] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastIsoRef = useRef<string>("");
  const tabIdRef = useRef(tabId);

  // Initial load on tab switch.
  useEffect(() => {
    tabIdRef.current = tabId;
    let cancelled = false;
    setMessages(null);
    setError(null);
    setDraft("");
    setAttachments([]);
    lastIsoRef.current = new Date(0).toISOString();

    (async () => {
      const r = await getWorkspaceMessagesAction(tabId);
      if (cancelled || tabIdRef.current !== tabId) return;
      if (!r.ok || !r.messages) {
        setError(r.error ?? "Načtení selhalo");
        setMessages([]);
        return;
      }
      setMessages(r.messages);
      const last = r.messages[r.messages.length - 1];
      lastIsoRef.current = last?.createdAt ?? new Date().toISOString();
      // Mark this tab as seen so unread badge clears.
      void markTabSeenAction(tabId);
    })();

    return () => {
      cancelled = true;
    };
  }, [tabId]);

  // Polling for new manager messages.
  useEffect(() => {
    if (!messages) return;
    const id = window.setInterval(async () => {
      if (document.hidden) return;
      const since = lastIsoRef.current;
      const r = await pollNewMessagesAction(tabId, since);
      if (tabIdRef.current !== tabId) return;
      if (!r.ok || !r.messages || r.messages.length === 0) return;
      setMessages((prev) => {
        if (!prev) return r.messages!;
        const seen = new Set(prev.map((m) => m.id));
        const fresh = r.messages!.filter((m) => !seen.has(m.id));
        if (fresh.length === 0) return prev;
        const merged = [...prev, ...fresh];
        const last = merged[merged.length - 1];
        if (last) lastIsoRef.current = last.createdAt;
        // Touch lastSeenAt so unread badge stays at zero while tab is open.
        void markTabSeenAction(tabId);
        return merged;
      });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [messages, tabId]);

  // Autoscroll on new messages.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages?.length]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (attachments.length + files.length > 5) {
        setError("Max 5 obrázků na zprávu");
        return;
      }
      setUploading(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append("file", file);
          const r = await uploadManagerAttachmentAction(fd);
          if (!r.ok || !r.url) {
            setError(r.error ?? "Upload selhal");
            break;
          }
          setAttachments((prev) => [...prev, r.url!]);
        }
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [attachments.length],
  );

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;
    const localAttachments = [...attachments];
    startSending(async () => {
      setError(null);
      const r = await sendUserMessageAction(tabId, trimmed, localAttachments);
      if (!r.ok || !r.message) {
        setError(r.error ?? "Odeslání selhalo");
        return;
      }
      setMessages((prev) => (prev ? [...prev, r.message!] : [r.message!]));
      lastIsoRef.current = r.message.createdAt;
      setDraft("");
      setAttachments([]);
      onMessageSent?.();
    });
  };

  return (
    <section
      className="flex h-[calc(100vh-12rem)] min-h-[480px] flex-col rounded-lg border bg-card shadow-sm"
      aria-label={`Workspace ${tabTitle}`}
    >
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <h2 className="truncate text-sm font-semibold text-foreground">
            {tabTitle}
          </h2>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5"
      >
        {messages === null && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Načítám konverzaci…
          </div>
        )}
        {messages?.length === 0 && (
          <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            Začni konverzaci — napiš manažerce, co potřebuješ vyřešit.
          </div>
        )}
        {messages?.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {error && (
        <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="border-t bg-background/50 p-3">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((url) => (
              <div
                key={url}
                className="group relative h-14 w-14 overflow-hidden rounded border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Příloha"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) => prev.filter((u) => u !== url))
                  }
                  className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Odebrat přílohu"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={uploading || isSending || attachments.length >= 5}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Přidat obrázek"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
          </Button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            maxLength={8000}
            placeholder="Napiš zprávu manažerce…  (Ctrl/⌘+Enter odešle)"
            disabled={isSending}
            className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={isSending || !draft.trim()}
            aria-label="Odeslat"
          >
            {isSending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: WorkspaceMessageRow }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const Icon = isUser ? User2 : isSystem ? Cog : Sparkles;
  const label = isUser ? "Ty" : isSystem ? "Systém" : "Manažerka";
  const align = isUser ? "items-end" : "items-start";
  const bubbleColor = isUser
    ? "bg-primary text-primary-foreground"
    : isSystem
      ? "bg-muted text-muted-foreground border"
      : "bg-card border";

  return (
    <div className={cn("flex flex-col gap-1", align)}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3" />
        <span>{label}</span>
        <span>·</span>
        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm",
          bubbleColor,
        )}
      >
        {message.contentMd && (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>:first-child]:mt-0 [&>:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.contentMd}
            </ReactMarkdown>
          </div>
        )}
        {message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((url) =>
              isImageUrl(url) ? (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Příloha"
                    className="max-h-48 rounded border bg-background object-cover"
                  />
                </a>
              ) : (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded border bg-background px-2 py-1 text-xs underline"
                >
                  Příloha
                </a>
              ),
            )}
          </div>
        )}
      </div>
      {!isUser && !isSystem && (
        <ManagerActionButtons />
      )}
    </div>
  );
}

function ManagerActionButtons() {
  // Phase 11b: stub action buttons. Phase 11c+ will wire them to artifact
  // creation / sharing / deletion endpoints. Disabled for now so the UI shows
  // the affordance without inviting clicks that would no-op silently.
  const actions = [
    { key: "execute", label: "Realizovat", icon: CheckCircle2 },
    { key: "save", label: "Uložit", icon: Save },
    { key: "share", label: "Sdílet", icon: Share2 },
    { key: "delete", label: "Smazat", icon: Trash2 },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <button
            key={a.key}
            type="button"
            disabled
            title="Brzy dostupné"
            className="inline-flex cursor-not-allowed items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground opacity-60"
          >
            <Icon className="size-3" />
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
