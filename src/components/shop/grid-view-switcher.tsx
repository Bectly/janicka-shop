"use client";

import { LayoutGrid, Grid3X3, List } from "lucide-react";

export type ViewMode = "grid-2" | "grid-3" | "list";

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: "grid-2", label: "2 sloupce", icon: LayoutGrid },
  { value: "grid-3", label: "3 sloupce", icon: Grid3X3 },
  { value: "list", label: "Seznam", icon: List },
];

interface GridViewSwitcherProps {
  currentView: ViewMode;
  onChange: (view: ViewMode) => void;
}

export function GridViewSwitcher({ currentView, onChange }: GridViewSwitcherProps) {
  return (
    <div
      className="hidden sm:flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5"
      role="radiogroup"
      aria-label="Zobrazení mřížky"
    >
      {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          role="radio"
          aria-checked={currentView === value}
          aria-label={label}
          title={label}
          className={`flex items-center justify-center rounded-md p-1.5 transition-colors duration-150 ${
            currentView === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
