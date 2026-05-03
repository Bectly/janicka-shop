"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function MailboxReplyForm({
  threadId,
  replyTo,
}: {
  threadId: string;
  replyTo: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") ?? "");

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/mailbox/threads/${encodeURIComponent(threadId)}/reply`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body }),
          },
        );
        const data = (await res.json().catch(() => null)) as
          | { ok: true }
          | { ok: false; error?: string }
          | null;

        if (!res.ok || !data?.ok) {
          setError(
            (data && "error" in data && data.error) ||
              "Odeslání odpovědi selhalo.",
          );
          return;
        }

        setSuccess(true);
        formRef.current?.reset();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Síťová chyba.");
      }
    });
  }

  const status = error
    ? error
    : success
      ? "Odpověď odeslána."
      : "Z odeslání se vytvoří nový záznam v konverzaci.";
  const statusClass = error
    ? "text-destructive"
    : success
      ? "text-emerald-600"
      : "text-muted-foreground";

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
        Odpověď na: <span className="font-medium text-foreground">{replyTo}</span>
      </div>
      <textarea
        name="body"
        required
        minLength={1}
        rows={6}
        placeholder="Napiš odpověď…"
        className="w-full resize-y border-0 bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        disabled={isPending}
      />
      <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-2">
        <p className={`text-xs ${statusClass}`}>{status}</p>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="size-4" />
          {isPending ? "Odesílání…" : "Odeslat"}
        </button>
      </div>
    </form>
  );
}
