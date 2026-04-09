"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ShieldCheck, AlertTriangle } from "lucide-react";

const STORAGE_KEY_STANDARD = "janicka-vinted-tc-banner-dismissed";
const STORAGE_KEY_URGENT = "janicka-vinted-tc-banner-urgent-dismissed";

// Urgent variant: April 28 – May 1, 2026 (inclusive)
const URGENT_FROM = new Date("2026-04-28T00:00:00+02:00"); // CEST
const URGENT_UNTIL = new Date("2026-05-02T00:00:00+02:00"); // May 1 inclusive

function isUrgentWindow() {
  const now = new Date();
  return now >= URGENT_FROM && now < URGENT_UNTIL;
}

export function VintedTcBanner() {
  const [visible, setVisible] = useState(false);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const isUrgent = isUrgentWindow();
    const storageKey = isUrgent ? STORAGE_KEY_URGENT : STORAGE_KEY_STANDARD;
    if (localStorage.getItem(storageKey)) return;
    setUrgent(isUrgent);
    setVisible(true);
  }, []);

  if (!visible) return null;

  const storageKey = urgent ? STORAGE_KEY_URGENT : STORAGE_KEY_STANDARD;

  if (urgent) {
    return (
      <div className="relative border-b border-red-300 bg-gradient-to-r from-red-50 to-rose-50 text-red-900">
        <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-center gap-2 px-4 py-3 pr-12 sm:px-6 lg:px-8">
          <AlertTriangle className="hidden size-4 shrink-0 text-red-600 sm:block" />
          <p className="text-center text-xs font-medium sm:text-sm">
            <span className="font-bold">Od 30. dubna Vinted automaticky získá právo na tvoje fotky</span>
            {" — "}bez možnosti odhlášení.{" "}
            <span className="font-semibold text-red-700">
              U&nbsp;Janičky? Tvoje fotky jsou tvoje. Vždy.
            </span>{" "}
            <Link
              href="/privacy"
              className="inline-flex items-center gap-0.5 font-semibold text-red-700 underline underline-offset-2 transition-colors hover:text-red-900"
            >
              Proč jsme jiní&nbsp;→
            </Link>
          </p>
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              localStorage.setItem(storageKey, "1");
            }}
            className="absolute right-2 inline-flex size-11 items-center justify-center rounded text-red-400 transition-colors hover:text-red-700 sm:right-4"
            aria-label="Zavřít oznámení"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative border-b border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 text-rose-900">
      <div className="mx-auto flex min-h-12 max-w-7xl items-center justify-center gap-2 px-4 py-2 pr-12 sm:px-6 lg:px-8">
        <ShieldCheck className="hidden size-4 shrink-0 text-rose-600 sm:block" />
        <p className="text-center text-xs font-medium sm:text-sm">
          <span className="font-semibold">Tvoje fotky jsou tvoje.</span>{" "}
          Nikdy je nepoužijeme k trénování AI.{" "}
          <span className="text-rose-600">
            Na rozdíl od jiných platforem nesdílíme tvoje data s umělou inteligencí.
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            localStorage.setItem(storageKey, "1");
          }}
          className="absolute right-2 inline-flex size-11 items-center justify-center rounded text-rose-400 transition-colors hover:text-rose-700 sm:right-4"
          aria-label="Zavřít oznámení"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
