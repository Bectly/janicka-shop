"use client";

import { useEffect, useRef } from "react";

// Accept either NEXT_PUBLIC_GA4_ID (short, preferred) or the legacy
// NEXT_PUBLIC_GA4_MEASUREMENT_ID. When neither is set the loader is a no-op.
const GA4_ID =
  process.env.NEXT_PUBLIC_GA4_ID ?? process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const PINTEREST_ID = process.env.NEXT_PUBLIC_PINTEREST_TAG_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const CONSENT_KEY = "janicka-cookie-consent";

interface Consent {
  analytics: boolean;
  marketing: boolean;
}

function getConsent(): Consent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

function loadScript(src: string, id: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.src = src;
  s.async = true;
  document.head.appendChild(s);
}

/**
 * Consent-gated analytics script loader.
 * Loads GA4 (analytics consent), Pinterest Tag + Meta Pixel (marketing consent).
 * Re-initializes when user changes consent via the cookie banner (cross-tab storage event).
 * Renders nothing — pure side-effect component.
 */
export function AnalyticsProvider() {
  const loaded = useRef({ ga4: false, pinterest: false, meta: false });

  useEffect(() => {
    function init() {
      const consent = getConsent();
      if (!consent) return;

      // ── GA4 ──────────────────────────────────────────────────────
      if (consent.analytics && GA4_ID && !loaded.current.ga4) {
        loaded.current.ga4 = true;
        window.dataLayer = window.dataLayer || [];
        window.gtag = (...args: unknown[]) => {
          window.dataLayer.push(args);
        };
        window.gtag("js", new Date());
        window.gtag("config", GA4_ID, { send_page_view: true });
        loadScript(
          `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`,
          "ga4-script",
        );
      }

      // ── Pinterest Tag ────────────────────────────────────────────
      if (consent.marketing && PINTEREST_ID && !loaded.current.pinterest) {
        loaded.current.pinterest = true;
        if (!window.pintrk) {
          const pn = function (...args: unknown[]) {
            pn.queue.push(args);
          };
          pn.queue = [] as unknown[][];
          pn.version = "3.0";
          window.pintrk = pn as typeof window.pintrk;
        }
        loadScript("https://s.pinimg.com/ct/core.js", "pinterest-script");
        window.pintrk("load", PINTEREST_ID);
        window.pintrk("page");
      }

      // ── Meta Pixel ───────────────────────────────────────────────
      if (consent.marketing && META_PIXEL_ID && !loaded.current.meta) {
        loaded.current.meta = true;
        if (!window.fbq) {
          const queue: unknown[] = [];
          const fn = Object.assign(
            (...args: unknown[]) => {
              if (fn.callMethod) {
                fn.callMethod(...args);
              } else {
                queue.push(args);
              }
            },
            {
              callMethod: undefined as ((...a: unknown[]) => void) | undefined,
              queue,
              push: (() => {}) as (...args: unknown[]) => void,
              loaded: true,
              version: "2.0",
            },
          );
          fn.push = fn as unknown as (...args: unknown[]) => void;
          window.fbq = fn as typeof window.fbq;
          if (!window._fbq) window._fbq = window.fbq;
        }
        loadScript(
          "https://connect.facebook.net/en_US/fbevents.js",
          "meta-pixel-script",
        );
        window.fbq("init", META_PIXEL_ID);
        window.fbq("track", "PageView");
      }
    }

    init();

    // Re-check when user changes consent (fires cross-tab via StorageEvent)
    function onStorage(e: StorageEvent) {
      if (e.key === CONSENT_KEY) init();
    }
    window.addEventListener("storage", onStorage);

    // Also listen for same-tab consent changes (custom event from CookieConsentBanner)
    function onConsentChange() {
      init();
    }
    window.addEventListener("cookie-consent-changed", onConsentChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cookie-consent-changed", onConsentChange);
    };
  }, []);

  return null;
}
