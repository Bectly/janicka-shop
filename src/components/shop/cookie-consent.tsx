"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "janicka-cookie-consent";

export interface CookieConsent {
  essential: true; // always on
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

function getSavedConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
}

function saveConsent(consent: CookieConsent) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  // Also set a cookie so server can read consent status
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `cookie-consent=1; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
  // Notify AnalyticsProvider in the same tab (StorageEvent only fires cross-tab)
  window.dispatchEvent(new Event("cookie-consent-changed"));
}

export function CookieConsentBanner() {
  // Lazy initializer: SSR returns false, client checks localStorage on mount.
  // Avoids extra render from useEffect + setState pattern.
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !getSavedConsent();
  });
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    // Allow re-opening the banner (e.g. from footer "Nastavení cookies" link)
    function handleReopen() {
      const saved = getSavedConsent();
      if (saved) {
        setAnalytics(saved.analytics);
        setMarketing(saved.marketing);
      }
      setShowDetails(true);
      setVisible(true);
    }
    window.addEventListener("show-cookie-consent", handleReopen);
    return () => window.removeEventListener("show-cookie-consent", handleReopen);
  }, []);

  const handleAcceptAll = useCallback(() => {
    const consent: CookieConsent = {
      essential: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    };
    saveConsent(consent);
    setVisible(false);
  }, []);

  const handleRejectAll = useCallback(() => {
    const consent: CookieConsent = {
      essential: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    };
    saveConsent(consent);
    setVisible(false);
  }, []);

  const handleSavePreferences = useCallback(() => {
    const consent: CookieConsent = {
      essential: true,
      analytics,
      marketing,
      timestamp: new Date().toISOString(),
    };
    saveConsent(consent);
    setVisible(false);
  }, [analytics, marketing]);

  if (!visible) return null;

  return (
    <div className="bottom-above-nav fixed inset-x-0 z-50 p-4" role="dialog" aria-label="Nastavení cookies" aria-modal="false">
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 shadow-lg">
        <h3 className="font-heading text-base font-semibold text-foreground">
          Soubory cookie
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Používáme cookies pro základní fungování webu. Analytické a marketingové
          cookies používáme pouze s vaším souhlasem, abychom mohli zlepšovat naše
          služby. Svůj souhlas můžete kdykoli změnit.
        </p>

        {showDetails && (
          <div className="mt-4 space-y-3 rounded-lg border bg-muted/30 p-4">
            {/* Essential — always on */}
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">
                  Nezbytné
                </span>
                <p className="text-xs text-muted-foreground">
                  Zajišťují základní funkce webu (košík, přihlášení).
                </p>
              </div>
              <input
                type="checkbox"
                checked
                disabled
                className="size-4 rounded border-border accent-primary"
              />
            </label>

            {/* Analytics */}
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">
                  Analytické
                </span>
                <p className="text-xs text-muted-foreground">
                  Pomáhají nám pochopit, jak web používáte.
                </p>
              </div>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
            </label>

            {/* Marketing */}
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <span className="text-sm font-medium text-foreground">
                  Marketingové
                </span>
                <p className="text-xs text-muted-foreground">
                  Umožňují zobrazení relevantních reklam.
                </p>
              </div>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {/* Czech law: Accept/Reject MUST be same size, font, color — no dark patterns */}
          <Button
            variant="outline"
            onClick={handleRejectAll}
            className="min-h-[44px] flex-1 sm:flex-none"
          >
            Odmítnout vše
          </Button>
          {showDetails ? (
            <Button
              variant="outline"
                onClick={handleSavePreferences}
              className="min-h-[44px] flex-1 sm:flex-none"
            >
              Uložit nastavení
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowDetails(true)}
              className="min-h-[44px] flex-1 sm:flex-none"
            >
              Nastavení
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleAcceptAll}
            className="min-h-[44px] flex-1 sm:flex-none"
          >
            Přijmout vše
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Více informací v{" "}
          <a href="/privacy" className="inline-flex min-h-[44px] items-center underline hover:text-foreground">
            zásadách ochrany osobních údajů
          </a>
          . Dozorový úřad:{" "}
          <span className="font-medium">ÚOOÚ</span> (Úřad pro ochranu osobních údajů).
        </p>
      </div>
    </div>
  );
}
