"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export function MailboxComposeForm({ prefillTo }: { prefillTo?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      to: String(fd.get("to") ?? ""),
      subject: String(fd.get("subject") ?? ""),
      body: String(fd.get("body") ?? ""),
      category: String(fd.get("category") ?? "support"),
    };

    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/mailbox/compose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as
          | { ok: true; threadId: string }
          | { ok: false; error?: string }
          | null;

        if (!res.ok || !data?.ok) {
          setError(
            (data && "error" in data && data.error) ||
              "Odeslání e-mailu selhalo.",
          );
          return;
        }

        router.push(`/admin/mailbox/${data.threadId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Síťová chyba.");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="border-b px-4 py-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Příjemce</span>
          <input
            type="text"
            name="to"
            required
            defaultValue={prefillTo ?? ""}
            placeholder="jmeno@example.com, druha@example.com"
            className="mt-1 block w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            disabled={isPending}
          />
        </label>
      </div>
      <div className="border-b px-4 py-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Odeslat jako</span>
          <select
            name="category"
            defaultValue="support"
            disabled={isPending}
            className="mt-1 block w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="support">Podpora (podpora@jvsatnik.cz)</option>
            <option value="orders">Objednávky (objednavky@jvsatnik.cz)</option>
            <option value="info">Info (info@jvsatnik.cz)</option>
          </select>
        </label>
      </div>
      <div className="border-b px-4 py-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Předmět</span>
          <input
            type="text"
            name="subject"
            required
            className="mt-1 block w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            disabled={isPending}
          />
        </label>
      </div>
      <textarea
        name="body"
        required
        rows={12}
        placeholder="Napiš zprávu…"
        className="w-full resize-y border-0 bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        disabled={isPending}
      />
      <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-2">
        <p className="text-xs text-destructive">{error ?? ""}</p>
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
