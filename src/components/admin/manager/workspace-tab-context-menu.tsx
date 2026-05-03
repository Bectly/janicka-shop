"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pin, PinOff, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceTabAction =
  | "pin"
  | "unpin"
  | "archive"
  | "unarchive"
  | "delete";

type Item = {
  key: WorkspaceTabAction;
  label: string;
  icon: typeof Pin;
  destructive?: boolean;
};

export function WorkspaceTabContextMenu({
  x,
  y,
  status,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  status: "active" | "pinned" | "archived";
  onSelect: (action: WorkspaceTabAction) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(x, vw - rect.width - 8);
    const top = Math.min(y, vh - rect.height - 8);
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const items: Item[] = [
    status === "pinned"
      ? { key: "unpin", label: "Odepnout", icon: PinOff }
      : { key: "pin", label: "Připnout", icon: Pin },
    status === "archived"
      ? { key: "unarchive", label: "Obnovit z archivu", icon: ArchiveRestore }
      : { key: "archive", label: "Archivovat", icon: Archive },
    { key: "delete", label: "Smazat", icon: Trash2, destructive: true },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Akce konverzace"
      className="fixed z-50 min-w-[180px] rounded-md border bg-popover p-1 shadow-lg"
      style={{ left: pos.left, top: pos.top }}
    >
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.key}
            type="button"
            role="menuitem"
            onClick={() => {
              onSelect(it.key);
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left transition-colors",
              it.destructive
                ? "text-destructive hover:bg-destructive/10"
                : "hover:bg-foreground/[0.06]",
            )}
          >
            <Icon className="size-4" />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
