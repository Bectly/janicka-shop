"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, ShoppingBag } from "lucide-react";

interface NewOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  paymentMethod: string | null;
  createdAt: string;
  customerName: string;
}

interface NotifyResponse {
  ts: string;
  count: number;
  orders: NewOrder[];
}

const POLL_INTERVAL_MS = 30_000;

function formatCzk(price: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Plays a short two-tone chime using Web Audio API — no asset download.
 * Falls back silently if AudioContext is unavailable (older browsers, iOS lock-screen).
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
    const tones = [880, 1175]; // A5, D6
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
    // Free the context after the last tone finishes
    window.setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // AudioContext might be blocked until user interaction — ignore.
  }
}

export function AdminOrderNotifier({
  soundEnabled,
}: {
  soundEnabled: boolean;
}) {
  const [toasts, setToasts] = useState<NewOrder[]>([]);
  const lastTsRef = useRef<string>(new Date().toISOString());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.hidden) return;
      try {
        const res = await fetch(
          `/api/admin/new-orders-since?ts=${encodeURIComponent(lastTsRef.current)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data: NotifyResponse = await res.json();
        lastTsRef.current = data.ts;
        if (cancelled || !mountedRef.current) return;
        if (data.orders.length > 0) {
          setToasts((prev) => [...data.orders, ...prev].slice(0, 5));
          if (soundEnabled) playChime();
        }
      } catch {
        // network errors are non-fatal — try again next tick
      }
    }

    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [soundEnabled]);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-end gap-2 px-4 sm:right-4 sm:left-auto sm:max-w-sm"
    >
      {toasts.map((order) => (
        <div
          key={order.id}
          className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-lg"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <ShoppingBag className="size-4" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-semibold text-emerald-900">Nová objednávka</p>
            <p className="text-emerald-800">
              {order.orderNumber} — {formatCzk(order.total)}
            </p>
            {order.customerName ? (
              <p className="text-xs text-emerald-700">{order.customerName}</p>
            ) : null}
            <Link
              href={`/admin/orders/${order.id}`}
              className="mt-1 inline-block text-xs font-medium text-emerald-700 underline underline-offset-2"
              onClick={() => dismiss(order.id)}
            >
              Zobrazit detail →
            </Link>
          </div>
          <button
            type="button"
            onClick={() => dismiss(order.id)}
            aria-label="Zavřít upozornění"
            className="text-emerald-700 transition-colors hover:text-emerald-900"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
