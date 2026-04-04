/**
 * Unified analytics event dispatcher.
 * Consent-gated: checks cookie consent before firing events to GA4, Pinterest Tag, and Meta Pixel.
 *
 * Env vars (all optional — scripts only load when ID is set):
 * - NEXT_PUBLIC_GA4_MEASUREMENT_ID
 * - NEXT_PUBLIC_PINTEREST_TAG_ID
 * - NEXT_PUBLIC_META_PIXEL_ID
 */

// ---------------------------------------------------------------------------
// Global type declarations
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    fbq: {
      (...args: unknown[]): void;
      callMethod?: (...args: unknown[]) => void;
      queue: unknown[];
      push: (...args: unknown[]) => void;
      loaded: boolean;
      version: string;
    };
    _fbq?: typeof window.fbq;
    pintrk: {
      (...args: unknown[]): void;
      queue: unknown[][];
      version: string;
    };
  }
}

// ---------------------------------------------------------------------------
// Consent helpers (reads from same localStorage key as CookieConsentBanner)
// ---------------------------------------------------------------------------
const CONSENT_KEY = "janicka-cookie-consent";

interface CookieConsent {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
}

function getConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as CookieConsent) : null;
  } catch {
    return null;
  }
}

function hasAnalyticsConsent(): boolean {
  return getConsent()?.analytics === true;
}

function hasMarketingConsent(): boolean {
  return getConsent()?.marketing === true;
}

// ---------------------------------------------------------------------------
// Safe callers — no-op when script not loaded or consent not given
// ---------------------------------------------------------------------------
function ga4(...args: unknown[]) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag(...args);
  }
}

function fbq(...args: unknown[]) {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq(...args);
  }
}

function pintrk(...args: unknown[]) {
  if (typeof window !== "undefined" && window.pintrk) {
    window.pintrk(...args);
  }
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------
export interface AnalyticsItem {
  id: string;
  name: string;
  price: number;
  brand?: string | null;
  category?: string;
  variant?: string; // e.g. "M / Černá"
}

// ---------------------------------------------------------------------------
// E-commerce events (GA4 + Pinterest + Meta Pixel)
// ---------------------------------------------------------------------------

/** PDP: user views a product detail page */
export function trackViewItem(item: AnalyticsItem) {
  if (hasAnalyticsConsent()) {
    ga4("event", "view_item", {
      currency: "CZK",
      value: item.price,
      items: [
        {
          item_id: item.id,
          item_name: item.name,
          price: item.price,
          item_brand: item.brand ?? undefined,
          item_category: item.category,
        },
      ],
    });
  }
  if (hasMarketingConsent()) {
    pintrk("track", "pagevisit", {
      product_id: item.id,
      product_name: item.name,
      product_price: item.price,
      product_category: item.category,
      currency: "CZK",
    });
    fbq("track", "ViewContent", {
      content_ids: [item.id],
      content_name: item.name,
      content_type: "product",
      value: item.price,
      currency: "CZK",
    });
  }
}

/** User adds an item to the cart */
export function trackAddToCart(item: AnalyticsItem) {
  if (hasAnalyticsConsent()) {
    ga4("event", "add_to_cart", {
      currency: "CZK",
      value: item.price,
      items: [
        {
          item_id: item.id,
          item_name: item.name,
          price: item.price,
          item_brand: item.brand ?? undefined,
          item_category: item.category,
          item_variant: item.variant,
        },
      ],
    });
  }
  if (hasMarketingConsent()) {
    pintrk("track", "addtocart", {
      product_id: item.id,
      product_name: item.name,
      product_price: item.price,
      currency: "CZK",
    });
    fbq("track", "AddToCart", {
      content_ids: [item.id],
      content_name: item.name,
      content_type: "product",
      value: item.price,
      currency: "CZK",
    });
  }
}

/** User enters the checkout flow */
export function trackBeginCheckout(items: AnalyticsItem[], total: number) {
  if (hasAnalyticsConsent()) {
    ga4("event", "begin_checkout", {
      currency: "CZK",
      value: total,
      items: items.map((i) => ({
        item_id: i.id,
        item_name: i.name,
        price: i.price,
        item_brand: i.brand ?? undefined,
        item_category: i.category,
      })),
    });
  }
  if (hasMarketingConsent()) {
    pintrk("track", "checkout", {
      value: total,
      currency: "CZK",
      order_quantity: items.length,
    });
    fbq("track", "InitiateCheckout", {
      content_ids: items.map((i) => i.id),
      num_items: items.length,
      value: total,
      currency: "CZK",
    });
  }
}

/** Order completed — fires on order confirmation page */
export function trackPurchase(
  transactionId: string,
  items: AnalyticsItem[],
  total: number,
) {
  if (hasAnalyticsConsent()) {
    ga4("event", "purchase", {
      transaction_id: transactionId,
      currency: "CZK",
      value: total,
      items: items.map((i) => ({
        item_id: i.id,
        item_name: i.name,
        price: i.price,
        item_brand: i.brand ?? undefined,
        item_category: i.category,
      })),
    });
  }
  if (hasMarketingConsent()) {
    pintrk("track", "checkout", {
      value: total,
      currency: "CZK",
      order_quantity: items.length,
      order_id: transactionId,
    });
    fbq("track", "Purchase", {
      content_ids: items.map((i) => i.id),
      content_type: "product",
      num_items: items.length,
      value: total,
      currency: "CZK",
    });
  }
}
