"use client";

import { Printer } from "lucide-react";

export function PrintTriggerButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
      }
    >
      <Printer className="size-4" />
      Vytisknout
    </button>
  );
}
