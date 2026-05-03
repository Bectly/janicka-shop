"use client";

import { useMemo, useState, useTransition } from "react";
import { Eye, Send, Loader2, CheckCircle, AlertCircle, Search } from "lucide-react";
import { sendTemplateTestEmail, type TemplateEntry } from "./actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ok"; recipient: string; messageId?: string }
  | { kind: "err"; error: string };

interface Props {
  templates: TemplateEntry[];
}

export function TemplatesList({ templates }: Props) {
  const [filter, setFilter] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("Vše");
  const [sendState, setSendState] = useState<Record<string, SendState>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const groups = useMemo(() => {
    const set = new Set(templates.map((t) => t.group));
    return ["Vše", ...Array.from(set)];
  }, [templates]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return templates.filter((t) => {
      if (activeGroup !== "Vše" && t.group !== activeGroup) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    });
  }, [templates, filter, activeGroup]);

  const grouped = useMemo(() => {
    const map = new Map<string, TemplateEntry[]>();
    for (const t of filtered) {
      const list = map.get(t.group) ?? [];
      list.push(t);
      map.set(t.group, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  function handleSendTest(key: string) {
    setPendingKey(key);
    setSendState((s) => ({ ...s, [key]: { kind: "sending" } }));
    startTransition(async () => {
      const res = await sendTemplateTestEmail(key);
      setPendingKey(null);
      if (res.success && res.recipient) {
        setSendState((s) => ({
          ...s,
          [key]: { kind: "ok", recipient: res.recipient!, messageId: res.messageId },
        }));
      } else {
        setSendState((s) => ({
          ...s,
          [key]: { kind: "err", error: res.error ?? "Odeslání selhalo." },
        }));
      }
    });
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Šablony e-mailů
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {templates.length} transakčních + marketingových šablon. Klikni na „Náhled&quot; nebo
            „Test → mně&quot; pro odeslání s ukázkovými daty.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Hledat šablonu…"
            className="pl-9"
            aria-label="Hledat šablonu"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1 border-b">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setActiveGroup(g)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              activeGroup === g
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-lg border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Žádné šablony neodpovídají filtru.
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {grouped.map(([group, items]) => (
            <div key={group}>
              {activeGroup === "Vše" ? (
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </h3>
              ) : null}
              <ul className="grid gap-3 sm:grid-cols-2">
                {items.map((t) => {
                  const state = sendState[t.key] ?? { kind: "idle" };
                  const previewUrl = `/api/admin/email-preview?template=${encodeURIComponent(t.key)}`;
                  return (
                    <li
                      key={t.key}
                      className="flex flex-col gap-2 rounded-lg border bg-background p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {t.label}
                          </p>
                          <p
                            className="mt-0.5 truncate text-xs text-muted-foreground"
                            title={t.subject}
                          >
                            {t.subject}
                          </p>
                          <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/80">
                            {t.key} · {t.from}
                          </p>
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-2">
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          <Eye className="size-3.5" />
                          Náhled
                        </a>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSendTest(t.key)}
                          disabled={
                            state.kind === "sending" ||
                            (pendingKey !== null && pendingKey !== t.key)
                          }
                        >
                          {state.kind === "sending" ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Send className="size-3.5" />
                          )}
                          Test → mně
                        </Button>
                      </div>

                      {state.kind === "ok" ? (
                        <p className="flex items-start gap-1.5 text-xs text-primary">
                          <CheckCircle className="mt-0.5 size-3.5 shrink-0" />
                          <span className="break-all">
                            Odesláno na {state.recipient}
                            {state.messageId ? ` · ${state.messageId}` : ""}
                          </span>
                        </p>
                      ) : null}
                      {state.kind === "err" ? (
                        <p className="flex items-start gap-1.5 text-xs text-destructive">
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                          <span className="break-words">{state.error}</span>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
