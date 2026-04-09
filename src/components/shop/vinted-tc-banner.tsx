"use client";

import { useState, useEffect } from "react";
import { X, ShieldCheck } from "lucide-react";

const STORAGE_KEY = "janicka-vinted-tc-banner-dismissed";

// Show only April 28 – May 1, 2026 (inclusive)
const SHOW_FROM = new Date("2026-04-28T00:00:00+02:00"); // CEST
const SHOW_UNTIL = new Date("2026-05-02T00:00:00+02:00"); // May 1 inclusive = until May 2 00:00

export function VintedTcBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const now = new Date();
    if (now < SHOW_FROM || now >= SHOW_UNTIL) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

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
            localStorage.setItem(STORAGE_KEY, "1");
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
