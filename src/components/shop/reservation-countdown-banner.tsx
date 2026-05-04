"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, AlertCircle } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";

const URGENT_THRESHOLD_MS = 2 * 60 * 1000;

/**
 * Sticky banner shown on /checkout. Surfaces the shortest reservation
 * countdown across cart items so the user is never surprised by an
 * expired-reservation submit error. When any item has expired, the banner
 * upgrades to a destructive state with a "Zkontrolovat košík" link.
 */
export function ReservationCountdownBanner() {
  const items = useCartStore((s) => s.items);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const expiries = items
    .map((i) => i.reservedUntil)
    .filter((v): v is string => Boolean(v))
    .map((iso) => new Date(iso).getTime());

  if (expiries.length === 0) return null;

  const shortest = Math.min(...expiries);
  const remaining = shortest - now;
  const hasExpired = remaining <= 0;
  const isUrgent = !hasExpired && remaining < URGENT_THRESHOLD_MS;

  const mins = Math.max(0, Math.floor(remaining / 60_000));
  const secs = Math.max(0, Math.floor((remaining % 60_000) / 1000));
  const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;

  if (hasExpired) {
    return (
      <div
        role="alert"
        className="sticky top-16 z-30 -mx-4 mb-4 flex items-center gap-2 border-y border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive sm:-mx-6 sm:rounded-lg sm:border lg:-mx-8"
      >
        <AlertCircle className="size-4 shrink-0" />
        <span className="flex-1">
          Některá rezervace vypršela.
        </span>
        <Link
          href="/cart"
          className="font-semibold underline underline-offset-2 hover:no-underline"
        >
          Zkontrolovat košík
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`sticky top-16 z-30 -mx-4 mb-4 flex items-center gap-2 border-y px-4 py-2.5 text-sm sm:-mx-6 sm:rounded-lg sm:border lg:-mx-8 ${
        isUrgent
          ? "animate-pulse border-destructive/30 bg-destructive/10 text-destructive"
          : "border-champagne-dark/40 bg-champagne-light text-charcoal"
      }`}
    >
      <Clock className="size-4 shrink-0" />
      <span className="flex-1">
        Vaše rezervace vyprší za <strong className="tabular-nums">{formatted}</strong>.
        Dokončete prosím objednávku včas.
      </span>
    </div>
  );
}
