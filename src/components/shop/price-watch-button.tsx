"use client";

import { Bell, Check } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useCallback, useEffect, useState } from "react";

interface PriceWatchButtonProps {
  productId: string;
  className?: string;
}

type State =
  | { kind: "idle" }
  | { kind: "prompt" }
  | { kind: "submitting" }
  | { kind: "watched" }
  | { kind: "error"; message: string };

const LS_KEY = "janicka:price-watch-email";

export function PriceWatchButton({ productId, className = "" }: PriceWatchButtonProps) {
  const role = useAuthStore((s) => s.role);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [email, setEmail] = useState("");

  // Hydrate "Hlídáš cenu" state for signed-in customers + returning anon visitors.
  useEffect(() => {
    let cancelled = false;
    async function check() {
      const storedEmail =
        typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
      const params = new URLSearchParams({ productId });
      if (role !== "customer" && storedEmail) params.set("email", storedEmail);
      else if (role !== "customer") return;
      try {
        const res = await fetch(`/api/price-watch/check?${params.toString()}`);
        if (!res.ok) return;
        const data: { watched?: boolean } = await res.json();
        if (!cancelled && data.watched) setState({ kind: "watched" });
      } catch {
        /* silent — UI stays in idle */
      }
    }
    check();
    return () => { cancelled = true; };
  }, [productId, role]);

  const submit = useCallback(
    async (overrideEmail?: string) => {
      setState({ kind: "submitting" });
      try {
        const res = await fetch("/api/price-watch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId,
            ...(overrideEmail ? { email: overrideEmail } : {}),
          }),
        });
        const data: { ok?: boolean; error?: string } = await res
          .json()
          .catch(() => ({}));
        if (res.ok && data.ok) {
          if (overrideEmail && typeof window !== "undefined") {
            window.localStorage.setItem(LS_KEY, overrideEmail);
          }
          setState({ kind: "watched" });
          return;
        }
        if (res.status === 429) {
          setState({ kind: "error", message: "Moc pokusů. Zkus to za chvilku znovu." });
          return;
        }
        if (data.error === "email_required") {
          setState({ kind: "prompt" });
          return;
        }
        setState({ kind: "error", message: "Nepodařilo se uložit. Zkus to znovu." });
      } catch {
        setState({ kind: "error", message: "Nepodařilo se uložit. Zkus to znovu." });
      }
    },
    [productId],
  );

  const handleClick = useCallback(() => {
    if (state.kind === "watched") return;
    if (role === "customer") {
      submit();
      return;
    }
    setState({ kind: "prompt" });
  }, [role, state.kind, submit]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!trimmed) return;
      submit(trimmed);
    },
    [email, submit],
  );

  const isWatched = state.kind === "watched";
  const baseBtn =
    "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95";
  const idleBtn =
    "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground";
  const watchedBtn = "border-primary/30 bg-primary/10 text-primary cursor-default";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isWatched || state.kind === "submitting"}
        className={`${baseBtn} ${isWatched ? watchedBtn : idleBtn} disabled:opacity-80`}
        aria-label={isWatched ? "Hlídáš cenu" : "Sledovat cenu"}
      >
        {isWatched ? <Check className="size-4" /> : <Bell className="size-4" />}
        {isWatched ? "Hlídáš cenu" : "Sledovat cenu"}
      </button>

      {state.kind === "prompt" && (
        <form
          onSubmit={handleSubmit}
          className="mt-3 rounded-lg border border-border bg-muted/40 p-3"
        >
          <p className="mb-1 text-sm font-medium text-foreground">
            Dej vědět, až cena spadne
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Pošleme ti jeden krátký email, jakmile zlevníme.
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Zadáním emailu souhlasíš se zpracováním dle{" "}
            <a href="/privacy" className="underline hover:text-foreground">
              zásad ochrany
            </a>
            . Email odstraníme po odeslání notifikace.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              required
              placeholder="tvuj@email.cz"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              autoComplete="email"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              aria-label="Email pro upozornění na cenu"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              Hlídat
            </button>
          </div>
        </form>
      )}

      {state.kind === "submitting" && (
        <p className="mt-2 text-xs text-muted-foreground">Ukládám…</p>
      )}

      {state.kind === "error" && (
        <p className="mt-2 text-xs text-destructive">{state.message}</p>
      )}
    </div>
  );
}
