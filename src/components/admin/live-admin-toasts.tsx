"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail, ShoppingBag, X } from "lucide-react";
import { useLiveState, type LiveState } from "@/hooks/use-live-state";

type ToastEntry =
  | {
      id: string;
      kind: "email";
      title: string;
      body: string;
      href: string;
    }
  | {
      id: string;
      kind: "order";
      title: string;
      body: string;
      href: string;
    };

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 5_000;

/**
 * Plays a short two-tone chime via Web Audio. No asset download; silent
 * fallback if AudioContext is unavailable or blocked (iOS lock screen,
 * tabs without prior user interaction).
 */
function playChime() {
  try {
    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const tones = [880, 1175];
    tones.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + idx * 0.16;
      const end = start + 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // ignore — sound is best-effort
  }
}

function formatCzk(price: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * R2 — unified live toast surface for the admin shell.
 *
 * Subscribes to the shared TanStack Query `["live-state"]` cache (fed by
 * useLiveState's 30s/visibility-aware polling) and diffs each new snapshot
 * against the previous one. A growth in `mailbox.unreadCount` or
 * `orders.latestOrderAt` flipping forward emits a top-right toast with
 * the relevant detail. The first snapshot is treated as a baseline so the
 * admin doesn't get a flood after login.
 */
export function LiveAdminToasts({ soundEnabled = false }: { soundEnabled?: boolean }) {
  const { data } = useLiveState();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const baselineRef = useRef<{
    mailboxUnread: number;
    lastEmailAt: string | null;
    lastOrderAt: string | null;
  } | null>(null);

  useEffect(() => {
    if (!data) return;
    const snapshot: LiveState = data;

    if (baselineRef.current === null) {
      baselineRef.current = {
        mailboxUnread: snapshot.mailbox.unreadCount,
        lastEmailAt: snapshot.mailbox.latestThreadAt,
        lastOrderAt: snapshot.orders.latestOrderAt,
      };
      return;
    }

    const newToasts: ToastEntry[] = [];
    const prev = baselineRef.current;

    const emailChanged =
      snapshot.mailbox.latestThreadAt &&
      snapshot.mailbox.latestThreadAt !== prev.lastEmailAt &&
      snapshot.mailbox.unreadCount > prev.mailboxUnread;
    if (emailChanged && snapshot.mailbox.latestUnread) {
      const u = snapshot.mailbox.latestUnread;
      newToasts.push({
        id: `email-${u.threadId}-${snapshot.ts}`,
        kind: "email",
        title: `Nový email od ${u.sender}`,
        body: u.subject || "(bez předmětu)",
        href: `/admin/mailbox/${u.threadId}`,
      });
    }

    const orderChanged =
      snapshot.orders.latestOrderAt &&
      snapshot.orders.latestOrderAt !== prev.lastOrderAt;
    if (orderChanged && snapshot.orders.latestOrder) {
      const o = snapshot.orders.latestOrder;
      newToasts.push({
        id: `order-${o.id}-${snapshot.ts}`,
        kind: "order",
        title: `Nová objednávka ${o.orderNumber} — ${formatCzk(o.total)}`,
        body: o.customerName || "",
        href: `/admin/orders/${o.id}`,
      });
    }

    if (newToasts.length > 0) {
      setToasts((prevToasts) =>
        // Newest first; older toasts get pushed down. Cap at MAX_TOASTS.
        [...newToasts, ...prevToasts].slice(0, MAX_TOASTS),
      );
      if (soundEnabled && newToasts.some((t) => t.kind === "order")) {
        playChime();
      }
    }

    baselineRef.current = {
      mailboxUnread: snapshot.mailbox.unreadCount,
      lastEmailAt: snapshot.mailbox.latestThreadAt,
      lastOrderAt: snapshot.orders.latestOrderAt,
    };
  }, [data, soundEnabled]);

  // Auto-dismiss each toast 5s after it appears. Toast IDs include the
  // snapshot ts so a re-add resets the timer naturally.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((p) => p.id !== t.id));
      }, AUTO_DISMISS_MS),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [toasts]);

  const dismiss = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => {
        const Icon = toast.kind === "email" ? Mail : ShoppingBag;
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-primary/20 bg-card p-3 shadow-lg"
          >
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-full text-primary-foreground ${
                toast.kind === "email" ? "bg-blue-600" : "bg-primary"
              }`}
            >
              <Icon className="size-4" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-foreground">{toast.title}</p>
              {toast.body ? (
                <p className="line-clamp-2 text-foreground/80">{toast.body}</p>
              ) : null}
              <Link
                href={toast.href}
                className="mt-1 inline-block text-xs font-medium text-primary underline underline-offset-2"
                onClick={() => dismiss(toast.id)}
              >
                Otevřít →
              </Link>
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Zavřít upozornění"
              className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
