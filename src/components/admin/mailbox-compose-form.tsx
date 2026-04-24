"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { sendNewMessageAction } from "@/app/(admin)/admin/mailbox/actions";

type State = { ok: boolean; error?: string; threadId?: string };

const INITIAL: State = { ok: false };

export function MailboxComposeForm({ prefillTo }: { prefillTo?: string }) {
  const [state, formAction, pending] = useActionState(sendNewMessageAction, INITIAL);

  return (
    <form
      action={formAction}
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
            disabled={pending}
          />
        </label>
      </div>
      <div className="border-b px-4 py-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Odeslat jako</span>
          <select
            name="category"
            defaultValue="support"
            disabled={pending}
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
            disabled={pending}
          />
        </label>
      </div>
      <textarea
        name="body"
        required
        rows={12}
        placeholder="Napiš zprávu…"
        className="w-full resize-y border-0 bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        disabled={pending}
      />
      <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-2">
        <p className="text-xs text-destructive">
          {state.error ?? ""}
        </p>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="size-4" />
          {pending ? "Odesílání…" : "Odeslat"}
        </button>
      </div>
    </form>
  );
}
