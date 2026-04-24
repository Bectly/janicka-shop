"use client";

import { useActionState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { sendReplyAction } from "@/app/(admin)/admin/mailbox/actions";

type State = { ok: boolean; error?: string };

const INITIAL: State = { ok: false };

export function MailboxReplyForm({
  threadId,
  replyTo,
}: {
  threadId: string;
  replyTo: string;
}) {
  const boundAction = sendReplyAction.bind(null, threadId);
  const [state, formAction, pending] = useActionState(boundAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && formRef.current) {
      formRef.current.reset();
    }
  }, [state.ok]);

  return (
    <form
      ref={formRef}
      action={formAction}
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
        disabled={pending}
      />
      <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-2">
        <p
          className={`text-xs ${
            state.error
              ? "text-destructive"
              : state.ok
                ? "text-emerald-600"
                : "text-muted-foreground"
          }`}
        >
          {state.error
            ? state.error
            : state.ok
              ? "Odpověď odeslána."
              : "Z odeslání se vytvoří nový záznam v konverzaci."}
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
