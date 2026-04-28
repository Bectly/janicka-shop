"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "pwa_install_dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaInstallBannerProps {
  /** Banner only renders when this is true (e.g. after first successful upload). */
  show: boolean;
}

function isMobileUserAgent(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari pre-PWA-spec uses navigator.standalone
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function PwaInstallBanner({ show }: PwaInstallBannerProps) {
  const [visible, setVisible] = useState(false);
  const [installable, setInstallable] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (!isMobileUserAgent()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setInstallable(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (!show) return;
    if (isStandalone()) return;
    if (!isMobileUserAgent()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setVisible(true);
  }, [show]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    const evt = promptRef.current;
    if (!evt) {
      // Fallback for iOS / browsers without beforeinstallprompt — keep banner
      // visible with instructions, but record dismissal so it doesn't nag.
      dismiss();
      return;
    }
    try {
      await evt.prompt();
      await evt.userChoice;
    } catch {
      /* ignore */
    } finally {
      promptRef.current = null;
      setInstallable(false);
      dismiss();
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Přidat aplikaci na plochu"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rose-700/30 bg-rose-500 text-white shadow-lg"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-md items-center gap-3 px-3 pt-3">
        <div className="flex-1 text-sm font-medium leading-tight">
          Přidej Janička Shop na plochu
          <div className="text-xs font-normal text-white/85">
            {installable
              ? "Rychlejší start, plné focení bez prohlížeče."
              : "V prohlížeči Safari: Sdílet → Přidat na plochu."}
          </div>
        </div>
        {installable && (
          <Button
            type="button"
            size="sm"
            onClick={install}
            className="h-9 gap-1.5 bg-white text-rose-600 hover:bg-white/90"
          >
            <Download className="size-4" aria-hidden />
            Přidat
          </Button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Zavřít"
          className="flex size-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
