"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import {
  deleteEmailDraftAction,
  getSignatureForAliasAction,
  saveEmailDraftAction,
} from "@/app/(admin)/admin/mailbox/actions";

type CategoryKey = "support" | "orders" | "info";

const CATEGORY_TO_ALIAS: Record<CategoryKey, string> = {
  support: "podpora@jvsatnik.cz",
  orders: "objednavky@jvsatnik.cz",
  info: "info@jvsatnik.cz",
};

const ALIAS_TO_CATEGORY: Record<string, CategoryKey> = {
  "podpora@jvsatnik.cz": "support",
  "objednavky@jvsatnik.cz": "orders",
  "info@jvsatnik.cz": "info",
};

const AUTOSAVE_DEBOUNCE_MS = 10_000;

function categoryFromAlias(alias: string | undefined | null): CategoryKey {
  if (!alias) return "support";
  return ALIAS_TO_CATEGORY[alias.trim().toLowerCase()] ?? "support";
}

export type ComposePrefillDraft = {
  id: string;
  fromAlias: string;
  toAddresses: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string;
};

export function MailboxComposeForm({
  prefillTo,
  prefillDraft,
}: {
  prefillTo?: string;
  prefillDraft?: ComposePrefillDraft;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [to, setTo] = useState<string>(
    prefillDraft?.toAddresses.join(", ") ?? prefillTo ?? "",
  );
  const [category, setCategory] = useState<CategoryKey>(
    categoryFromAlias(prefillDraft?.fromAlias),
  );
  const [subject, setSubject] = useState<string>(prefillDraft?.subject ?? "");
  const [body, setBody] = useState<string>(
    prefillDraft?.bodyText || prefillDraft?.bodyHtml || "",
  );

  const draftIdRef = useRef<string | null>(prefillDraft?.id ?? null);
  const [savedAt, setSavedAt] = useState<Date | null>(
    prefillDraft ? new Date() : null,
  );
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [savedRelative, setSavedRelative] = useState<string>("");

  // Tick the "Uloženo před X" indicator every 30s.
  useEffect(() => {
    if (!savedAt) return;
    const tick = () => setSavedRelative(formatSavedRelative(savedAt));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [savedAt]);

  const dirtyRef = useRef(false);
  const savingRef = useRef(false);

  const performSave = useCallback(async (): Promise<void> => {
    if (savingRef.current) return;
    if (!to.trim() && !subject.trim() && !body.trim()) return;
    savingRef.current = true;
    setSavingState("saving");
    try {
      const recipients = to
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0);
      const res = await saveEmailDraftAction({
        id: draftIdRef.current ?? undefined,
        fromAlias: CATEGORY_TO_ALIAS[category],
        toAddresses: recipients,
        subject,
        bodyText: body,
        bodyHtml: body,
      });
      draftIdRef.current = res.id;
      setSavedAt(new Date());
      setSavingState("saved");
      dirtyRef.current = false;
    } catch (err) {
      setSavingState("error");
      // Surface but keep dirty so the next change retries.
      console.error("[mailbox-compose] autosave failed:", err);
    } finally {
      savingRef.current = false;
    }
  }, [to, category, subject, body]);

  // Debounced autosave on every relevant change.
  useEffect(() => {
    dirtyRef.current = true;
    const handle = window.setTimeout(() => {
      void performSave();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [to, category, subject, body, performSave]);

  // Load signature when alias changes (only when body is empty so we don't clobber).
  useEffect(() => {
    if (body.trim().length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const sig = await getSignatureForAliasAction(CATEGORY_TO_ALIAS[category]);
        if (!cancelled && sig?.bodyHtml) {
          // Inject signature as plain-ish text separator so plain-textarea looks fine.
          // (HTML-aware editor lands later; for now strip tags into text.)
          const text = sig.bodyHtml.replace(/<[^>]+>/g, "").trim();
          if (text) setBody((prev) => (prev ? prev : `\n\n--\n${text}`));
        }
      } catch {
        /* signature optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, body]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const payload = {
      to,
      subject,
      body,
      category,
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

        // Clean up the draft so it doesn't haunt the Koncepty folder.
        if (draftIdRef.current) {
          try {
            await deleteEmailDraftAction(draftIdRef.current);
          } catch {
            /* best-effort */
          }
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
            value={to}
            onChange={(e) => setTo(e.target.value)}
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
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryKey)}
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
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 block w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            disabled={isPending}
          />
        </label>
      </div>
      <textarea
        name="body"
        required
        rows={12}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Napiš zprávu…"
        className="w-full resize-y border-0 bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        disabled={isPending}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-4 py-2">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <p
            className="text-xs text-muted-foreground"
            data-testid="mailbox-compose-autosave"
          >
            {savingState === "saving"
              ? "Ukládám…"
              : savingState === "saved" && savedAt
                ? `Uloženo ${savedRelative}`
                : savingState === "error"
                  ? "Automatické uložení selhalo."
                  : "Automatické uložení každých 10 s."}
          </p>
          <button
            type="button"
            onClick={() => void performSave()}
            disabled={isPending}
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Uložit koncept
          </button>
          {error ? (
            <p className="text-xs text-destructive" role="alert">{error}</p>
          ) : null}
        </div>
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

function formatSavedRelative(date: Date): string {
  const diffSec = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return `před ${diffSec} s`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `před ${min} min`;
  const hr = Math.floor(min / 60);
  return `před ${hr} h`;
}
