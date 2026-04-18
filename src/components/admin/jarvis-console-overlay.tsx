"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GripHorizontal, Maximize2, Terminal, X } from "lucide-react";
import { useJarvisConsole } from "@/lib/stores/jarvis-console-store";

export function JarvisConsoleOverlay() {
  const isOpen = useJarvisConsole((s) => s.isOpen);
  const height = useJarvisConsole((s) => s.height);
  const toggle = useJarvisConsole((s) => s.toggle);
  const close = useJarvisConsole((s) => s.close);
  const setHeight = useJarvisConsole((s) => s.setHeight);

  const [hasOpened, setHasOpened] = useState(false);
  const resizingRef = useRef(false);
  if (isOpen && !hasOpened) setHasOpened(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "`") {
        e.preventDefault();
        toggle();
        return;
      }
      if (e.key === "Escape" && useJarvisConsole.getState().isOpen) {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, close]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = true;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ns-resize";

      function onMove(ev: MouseEvent) {
        if (!resizingRef.current) return;
        setHeight(window.innerHeight - ev.clientY);
      }
      function onUp() {
        resizingRef.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [setHeight],
  );

  if (!hasOpened) return null;

  return (
    <div
      aria-hidden={!isOpen}
      role="dialog"
      aria-label="JARVIS konzole"
      className={`fixed inset-x-0 bottom-0 z-50 flex flex-col border-t bg-background shadow-2xl transition-transform duration-200 ease-out ${
        isOpen ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
      style={{
        height: `min(${height}px, 90vh)`,
      }}
    >
      {/* Resize handle — desktop only */}
      <div
        role="separator"
        aria-label="Změnit výšku terminálu"
        onMouseDown={startResize}
        className="group hidden h-2 shrink-0 cursor-ns-resize items-center justify-center border-b bg-muted/40 transition-colors duration-150 hover:bg-muted sm:flex"
      >
        <GripHorizontal className="size-4 text-muted-foreground/60 transition-colors duration-150 group-hover:text-muted-foreground" />
      </div>

      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b bg-card px-3 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Terminal className="size-4 text-primary" />
          <span>JARVIS konzole</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            <kbd className="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">
              Ctrl
            </kbd>
            +
            <kbd className="rounded border bg-background px-1 py-0.5 font-mono text-[10px]">
              `
            </kbd>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/admin/jarvis"
            className="inline-flex size-7 items-center justify-center rounded transition-all duration-150 hover:bg-muted active:scale-95"
            title="Otevřít ve fullscreenu"
            aria-label="Otevřít ve fullscreenu"
          >
            <Maximize2 className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={close}
            className="inline-flex size-7 items-center justify-center rounded transition-all duration-150 hover:bg-muted active:scale-95"
            title="Zavřít (Esc)"
            aria-label="Zavřít konzoli"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* iframe — mounted once, kept alive across admin navigations */}
      <iframe
        src="https://jarvis-janicka.jvsatnik.cz"
        title="JARVIS Remote Console"
        className="w-full flex-1 bg-black"
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
        allow=""
        tabIndex={isOpen ? 0 : -1}
      />
    </div>
  );
}

export function JarvisConsoleToggle({
  className,
}: {
  className?: string;
}) {
  const toggle = useJarvisConsole((s) => s.toggle);
  const isOpen = useJarvisConsole((s) => s.isOpen);

  return (
    <button
      type="button"
      onClick={toggle}
      title="JARVIS konzole (Ctrl+`)"
      aria-label="Přepnout JARVIS konzoli"
      aria-expanded={isOpen}
      className={`inline-flex size-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground ${
        isOpen ? "bg-primary/10 text-primary" : ""
      } ${className ?? ""}`}
    >
      <Terminal className="size-4" />
    </button>
  );
}
