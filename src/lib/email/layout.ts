/**
 * Shared branded email layout — Janička Shop.
 * One header + footer + card wrapper used by all transactional/marketing emails
 * so brand feel (serif display, blush cream bg, magenta accent) is consistent.
 *
 * OKLCH design tokens from globals.css approximated to email-safe HEX:
 *   brand         oklch(0.55 0.20 350)   ≈ #B8407A
 *   brand-dark    oklch(0.40 0.18 350)   ≈ #85275A
 *   brand-light   oklch(0.75 0.12 350)   ≈ #D791AA
 *   champagne     oklch(0.88 0.04 80)    ≈ #E8D9B8
 *   blush         oklch(0.96 0.02 350)   ≈ #F7EAEF
 *   charcoal      oklch(0.25 0.015 350)  ≈ #3A3034
 *   charcoal-soft oklch(0.45 0.02 350)   ≈ #6E5F67
 *
 * All styles inlined — no <style> tags (Gmail/Outlook strip them).
 */

export const BRAND = {
  primary: "#B8407A",
  primaryDark: "#85275A",
  primaryLight: "#D791AA",
  champagne: "#E8D9B8",
  champagneSoft: "#F5EAD2",
  blush: "#F7EAEF",
  blushSoft: "#FBF3F6",
  ivory: "#FBF7F8",
  pageBg: "#F5EFF2",
  charcoal: "#2E2428",
  charcoalSoft: "#6E5F67",
  charcoalMuted: "#9A8E94",
  border: "#ECDFE5",
  borderSoft: "#F3E9EE",
  success: "#5C8A6D",
  successSoft: "#E8F1EA",
  warning: "#B07A2B",
  warningSoft: "#FBF2E1",
  danger: "#B84040",
  dangerSoft: "#F7E4E4",
  white: "#FFFFFF",
} as const;

export const FONTS = {
  serif: `'Cormorant Garamond', 'Playfair Display', Georgia, 'Times New Roman', serif`,
  sans: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  mono: `'SF Mono', Menlo, Consolas, monospace`,
} as const;

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://jvsatnik.cz";
}

export function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatPriceCzk(price: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

interface ButtonOpts {
  href: string;
  label: string;
  variant?: "primary" | "outline" | "dark";
  align?: "left" | "center";
}

/**
 * Bulletproof button — uses table markup for Outlook compatibility,
 * falls back to inline-block anchor elsewhere. Rounded, brand-coloured.
 */
export function renderButton({ href, label, variant = "primary", align = "center" }: ButtonOpts): string {
  const styles = variant === "outline"
    ? { bg: BRAND.white, color: BRAND.primary, border: BRAND.primary }
    : variant === "dark"
      ? { bg: BRAND.charcoal, color: BRAND.white, border: BRAND.charcoal }
      : { bg: BRAND.primary, color: BRAND.white, border: BRAND.primary };

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="${align}" class="j-btn" style="margin: 0 ${align === "center" ? "auto" : "0"};">
      <tr>
        <td align="center" style="border-radius: 999px; background: ${styles.bg}; border: 1.5px solid ${styles.border};">
          <a href="${escapeHtml(href)}" style="display: inline-block; padding: 13px 32px; font-family: ${FONTS.sans}; font-size: 14px; font-weight: 600; color: ${styles.color}; text-decoration: none; letter-spacing: 0.04em; text-transform: uppercase; border-radius: 999px; mso-padding-alt: 0;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/** Subtle decorative divider with brand accent dot in the middle. */
export function renderDivider(): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0;">
      <tr>
        <td align="center" style="padding: 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="border-top: 1px solid ${BRAND.border}; width: 80px; line-height: 1px; font-size: 0;">&nbsp;</td>
            <td style="padding: 0 12px; line-height: 1; font-size: 14px; color: ${BRAND.primaryLight};">&#10022;</td>
            <td style="border-top: 1px solid ${BRAND.border}; width: 80px; line-height: 1px; font-size: 0;">&nbsp;</td>
          </tr></table>
        </td>
      </tr>
    </table>`;
}

interface LayoutOpts {
  preheader?: string;
  contentHtml: string;
  unsubscribeUrl?: string;
  /** Override default unsubscribe explanation copy (newsletter-default if omitted). */
  unsubscribeText?: string;
  footerNote?: string;
  showTagline?: boolean;
  lang?: string;
  /** Override outer page background (defaults to BRAND.pageBg blush). */
  pageBg?: string;
}

/**
 * Full email HTML shell — doctype → head → preheader → branded header →
 * white content card → brand footer. Content card is 600px, fluid on mobile.
 */
export function renderLayout({
  preheader,
  contentHtml,
  unsubscribeUrl,
  unsubscribeText,
  footerNote,
  showTagline = true,
  lang = "cs",
  pageBg,
}: LayoutOpts): string {
  const baseUrl = getBaseUrl();
  const logoUrl = `${baseUrl}/logo/logo-email.png`;
  const bg = pageBg ?? BRAND.pageBg;

  const preheaderHtml = preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: ${bg}; opacity: 0;">${escapeHtml(preheader)}</div>`
    : "";

  const unsubscribeHtml = unsubscribeUrl
    ? `<p style="margin: 12px 0 0; font-family: ${FONTS.sans}; font-size: 11px; color: ${BRAND.charcoalMuted}; line-height: 1.6;">${escapeHtml(unsubscribeText ?? "Tenhle email ti chodí, protože ses přihlásila k odběru novinek.")} <a href="${escapeHtml(unsubscribeUrl)}" style="color: ${BRAND.charcoalSoft}; text-decoration: underline;">Odhlásit se</a></p>`
    : "";

  const footerNoteHtml = footerNote
    ? `<p style="margin: 0 0 12px; font-family: ${FONTS.sans}; font-size: 12px; color: ${BRAND.charcoalSoft}; line-height: 1.7;">${footerNote}</p>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${lang}">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>Janička Shop</title>
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&amp;family=Inter:wght@400;500;600;700&amp;display=swap" rel="stylesheet" />
  <!--<![endif]-->
  <style type="text/css">
    /* Gmail / Apple Mail / Outlook.com — ignored by Outlook desktop (falls back to fluid tables). */
    body { margin: 0 !important; padding: 0 !important; }
    table { border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }
    a { text-decoration: none; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
    .j-container { width: 100% !important; max-width: 600px !important; }
    @media only screen and (max-width: 520px) {
      .j-card { padding: 28px 22px !important; border-radius: 16px !important; }
      .j-header { padding: 18px 14px 16px !important; }
      .j-h1 { font-size: 26px !important; line-height: 1.18 !important; }
      .j-body { font-size: 14px !important; }
      .j-eyebrow { font-size: 10px !important; }
      .j-btn a { padding: 14px 24px !important; font-size: 13px !important; }
      .j-stack { display: block !important; width: 100% !important; padding: 0 0 18px !important; border-left: none !important; border-top: 1px solid ${BRAND.borderSoft} !important; margin-top: 14px !important; }
      .j-stack-first { padding: 0 0 14px !important; border-left: none !important; border-top: none !important; }
      .j-grid-cell { display: block !important; width: 100% !important; padding: 6px 0 !important; }
      .j-product-img { height: auto !important; min-height: 200px !important; }
      .j-total-label { font-size: 18px !important; }
      .j-total-amount { font-size: 20px !important; }
      .j-footer-pad { padding: 20px 12px !important; }
    }
    /* Dark-mode fix: keep branded light palette on clients that auto-invert. */
    @media (prefers-color-scheme: dark) {
      .j-card { background: ${BRAND.white} !important; color: ${BRAND.charcoal} !important; }
      .j-text { color: ${BRAND.charcoalSoft} !important; }
      .j-heading { color: ${BRAND.charcoal} !important; }
    }
  </style>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a { font-family: Georgia, 'Times New Roman', serif !important; }
    .j-card { border: 1px solid ${BRAND.borderSoft} !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; width: 100%; background: ${bg}; font-family: ${FONTS.sans}; color: ${BRAND.charcoal}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: ${bg};">
    <tr>
      <td align="center" style="padding: 24px 12px 48px;">

        <!-- Container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="j-container" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td align="center" class="j-header" style="padding: 24px 16px 20px;">
              <a href="${baseUrl}" style="text-decoration: none; display: inline-block;">
                <img src="${logoUrl}" alt="Janička Shop" width="140" style="display: block; margin: 0 auto; height: auto; max-height: 56px; width: auto; max-width: 180px; border: 0; outline: none;" />
              </a>
              ${showTagline ? `<p style="margin: 12px 0 0; font-family: ${FONTS.serif}; font-size: 13px; font-style: italic; color: ${BRAND.primary}; letter-spacing: 0.12em; text-transform: uppercase;">Second hand s láskou</p>` : ""}
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td class="j-card" style="background: ${BRAND.white}; border-radius: 20px; padding: 40px 32px; box-shadow: 0 1px 2px rgba(58, 48, 52, 0.04), 0 8px 24px rgba(184, 64, 122, 0.06); border: 1px solid ${BRAND.borderSoft};">
              ${contentHtml}
            </td>
          </tr>

          <!-- Brand strip -->
          <tr>
            <td align="center" style="padding: 28px 16px 8px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
                <td style="border-top: 1px solid ${BRAND.border}; width: 48px; line-height: 1px; font-size: 0;">&nbsp;</td>
                <td style="padding: 0 14px;">
                  <span style="font-family: ${FONTS.serif}; font-size: 15px; font-style: italic; color: ${BRAND.primary}; letter-spacing: 0.08em;">&mdash; Janička &mdash;</span>
                </td>
                <td style="border-top: 1px solid ${BRAND.border}; width: 48px; line-height: 1px; font-size: 0;">&nbsp;</td>
              </tr></table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" class="j-footer-pad" style="padding: 8px 16px 24px;">
              ${footerNoteHtml}
              <p style="margin: 0 0 6px; font-family: ${FONTS.sans}; font-size: 12px; color: ${BRAND.charcoalSoft}; line-height: 1.7;">
                Pečlivě vybraný second hand &middot;
                <a href="${baseUrl}/products?sort=newest" style="color: ${BRAND.charcoalSoft}; text-decoration: underline;">novinky</a> &middot;
                <a href="${baseUrl}/kontakt" style="color: ${BRAND.charcoalSoft}; text-decoration: underline;">kontakt</a>
              </p>
              <p style="margin: 0 0 6px; font-family: ${FONTS.sans}; font-size: 12px; color: ${BRAND.charcoalSoft}; line-height: 1.7;">
                <a href="mailto:info@janicka.cz" style="color: ${BRAND.charcoalSoft}; text-decoration: none;">info@janicka.cz</a>
              </p>
              <p style="margin: 0; font-family: ${FONTS.sans}; font-size: 11px; color: ${BRAND.charcoalMuted}; line-height: 1.6;">
                <a href="${baseUrl}/podminky" style="color: ${BRAND.charcoalMuted}; text-decoration: underline;">Obchodní podmínky</a> &middot;
                <a href="${baseUrl}/privacy" style="color: ${BRAND.charcoalMuted}; text-decoration: underline;">Ochrana osobních údajů</a>
              </p>
              ${unsubscribeHtml}
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Small helper: render an eyebrow label — the tiny uppercase caption above
 * headings in cards (used e.g. for "Objednávka", "Doručení").
 */
export function renderEyebrow(text: string): string {
  return `<p class="j-eyebrow" style="margin: 0 0 6px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: ${BRAND.primary};">${escapeHtml(text)}</p>`;
}

/** Serif display heading — used once at top of card. */
export function renderDisplayHeading(text: string): string {
  return `<h1 class="j-h1 j-heading" style="margin: 0 0 16px; font-family: ${FONTS.serif}; font-size: 30px; font-weight: 600; line-height: 1.15; letter-spacing: -0.01em; color: ${BRAND.charcoal};">${escapeHtml(text)}</h1>`;
}

/** Body paragraph — default copy style. */
export function renderBody(text: string): string {
  return `<p class="j-body j-text" style="margin: 0 0 14px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">${text}</p>`;
}

interface ProductRowItem {
  name: string;
  brand?: string | null;
  meta?: string | null;
  url: string;
  image?: string | null;
  price: number;
  compareAt?: number | null;
}

/**
 * Single product as a horizontal row (image left, info right) — for transactional
 * lists (abandoned cart, order summary, review request) where vertical density matters.
 */
export function renderProductRow(item: ProductRowItem, isFirst = false): string {
  const imageHtml = item.image
    ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" width="96" height="120" style="display: block; width: 96px; height: 120px; object-fit: cover; border-radius: 10px; border: 1px solid ${BRAND.borderSoft};" />`
    : `<div style="width: 96px; height: 120px; background: ${BRAND.blushSoft}; border-radius: 10px; border: 1px solid ${BRAND.borderSoft};"></div>`;

  const priceHtml = item.compareAt && item.compareAt > item.price
    ? `<span style="font-family: ${FONTS.sans}; font-size: 12px; color: ${BRAND.charcoalMuted}; text-decoration: line-through; margin-right: 6px;">${formatPriceCzk(item.compareAt)}</span><strong style="font-family: ${FONTS.sans}; font-size: 15px; color: ${BRAND.primary};">${formatPriceCzk(item.price)}</strong>`
    : `<strong style="font-family: ${FONTS.sans}; font-size: 15px; color: ${BRAND.charcoal};">${formatPriceCzk(item.price)}</strong>`;

  const brandHtml = item.brand
    ? `<div style="font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: ${BRAND.primary}; margin-bottom: 4px;">${escapeHtml(item.brand)}</div>`
    : "";

  const metaHtml = item.meta
    ? `<div style="font-family: ${FONTS.sans}; font-size: 12px; color: ${BRAND.charcoalSoft}; margin-top: 4px;">${escapeHtml(item.meta)}</div>`
    : "";

  const topBorder = isFirst ? "none" : `1px solid ${BRAND.borderSoft}`;

  return `
    <tr>
      <td valign="top" style="padding: 16px 0 16px 0; border-top: ${topBorder}; width: 96px;">
        <a href="${escapeHtml(item.url)}" style="text-decoration: none; display: inline-block;">${imageHtml}</a>
      </td>
      <td valign="top" style="padding: 16px 0 16px 16px; border-top: ${topBorder};">
        ${brandHtml}
        <a href="${escapeHtml(item.url)}" style="text-decoration: none;"><span style="font-family: ${FONTS.serif}; font-size: 17px; font-weight: 600; line-height: 1.25; color: ${BRAND.charcoal};">${escapeHtml(item.name)}</span></a>
        ${metaHtml}
        <div style="margin-top: 8px;">${priceHtml}</div>
      </td>
    </tr>`;
}

/** Render a list of products as stacked rows, wrapped in a single table. */
export function renderProductRowList(items: ProductRowItem[]): string {
  if (items.length === 0) return "";
  const rows = items.map((item, i) => renderProductRow(item, i === 0)).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 8px 0;">${rows}</table>`;
}

interface ProductGridItem {
  name: string;
  brand?: string | null;
  meta?: string | null;
  url: string;
  image?: string | null;
  price: number;
  compareAt?: number | null;
  /** Optional small caption shown below price (e.g. "Unikát"). */
  caption?: string | null;
}

/**
 * Product grid (2 or 3 columns) — for marketing / discovery emails (campaigns,
 * new arrivals, win-back). Uses nested tables for Outlook compatibility.
 */
export function renderProductGrid(items: ProductGridItem[], columns: 2 | 3 = 2): string {
  if (items.length === 0) return "";
  const widthPct = columns === 3 ? "33.33%" : "50%";

  const cells = items.map((p) => {
    const imageHtml = p.image
      ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" class="j-product-img" style="display: block; width: 100%; height: 220px; object-fit: cover; border-radius: 12px; border: 1px solid ${BRAND.borderSoft};" />`
      : `<div class="j-product-img" style="width: 100%; height: 220px; background: ${BRAND.blushSoft}; border-radius: 12px; border: 1px solid ${BRAND.borderSoft};"></div>`;

    const priceHtml = p.compareAt && p.compareAt > p.price
      ? `<span style="font-family: ${FONTS.sans}; font-size: 12px; color: ${BRAND.charcoalMuted}; text-decoration: line-through; margin-right: 6px;">${formatPriceCzk(p.compareAt)}</span><strong style="font-family: ${FONTS.sans}; font-size: 15px; color: ${BRAND.primary};">${formatPriceCzk(p.price)}</strong>`
      : `<strong style="font-family: ${FONTS.sans}; font-size: 15px; color: ${BRAND.charcoal};">${formatPriceCzk(p.price)}</strong>`;

    const brandHtml = p.brand
      ? `<div style="font-family: ${FONTS.sans}; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: ${BRAND.primary}; margin: 10px 0 2px;">${escapeHtml(p.brand)}</div>`
      : "";

    const metaHtml = p.meta
      ? `<div style="font-family: ${FONTS.sans}; font-size: 11px; color: ${BRAND.charcoalSoft}; margin-top: 2px;">${escapeHtml(p.meta)}</div>`
      : "";

    const captionHtml = p.caption
      ? `<div style="font-family: ${FONTS.serif}; font-size: 12px; font-style: italic; color: ${BRAND.primary}; margin-top: 6px;">${escapeHtml(p.caption)}</div>`
      : "";

    return `
      <td valign="top" align="left" class="j-grid-cell" style="width: ${widthPct}; padding: 8px;">
        <a href="${escapeHtml(p.url)}" style="text-decoration: none; color: inherit; display: block;">
          ${imageHtml}
          ${brandHtml}
          <div style="font-family: ${FONTS.serif}; font-size: 16px; font-weight: 600; line-height: 1.3; color: ${BRAND.charcoal}; margin-top: ${p.brand ? "0" : "10px"};">${escapeHtml(p.name)}</div>
          ${metaHtml}
          <div style="margin-top: 8px;">${priceHtml}</div>
          ${captionHtml}
        </a>
      </td>`;
  });

  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += columns) {
    const slice = cells.slice(i, i + columns);
    while (slice.length < columns) {
      slice.push(`<td class="j-grid-cell" style="width: ${widthPct}; padding: 8px;">&nbsp;</td>`);
    }
    rows.push(`<tr>${slice.join("")}</tr>`);
  }

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 16px -8px;">${rows.join("")}</table>`;
}

/**
 * Tiny pill / accent caption used inline (e.g. "Unikát · 1 ks").
 */
export function renderTagPill(text: string, tone: "primary" | "champagne" | "success" | "warning" = "primary"): string {
  const palette = tone === "champagne"
    ? { bg: BRAND.champagneSoft, fg: BRAND.warning }
    : tone === "success"
      ? { bg: BRAND.successSoft, fg: BRAND.success }
      : tone === "warning"
        ? { bg: BRAND.warningSoft, fg: BRAND.warning }
        : { bg: BRAND.blushSoft, fg: BRAND.primary };
  return `<span style="display: inline-block; padding: 4px 10px; border-radius: 999px; background: ${palette.bg}; color: ${palette.fg}; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;">${escapeHtml(text)}</span>`;
}

/** Soft info card (used for status banners, tracking numbers, etc.) */
export function renderInfoCard(contentHtml: string, tone: "blush" | "champagne" | "success" | "warning" = "blush"): string {
  const bg = tone === "success" ? BRAND.successSoft
    : tone === "warning" ? BRAND.warningSoft
    : tone === "champagne" ? BRAND.champagneSoft
    : BRAND.blushSoft;
  const border = tone === "success" ? BRAND.success
    : tone === "warning" ? BRAND.warning
    : tone === "champagne" ? BRAND.champagne
    : BRAND.primaryLight;
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 16px 0;">
      <tr>
        <td style="background: ${bg}; border-left: 3px solid ${border}; border-radius: 8px; padding: 16px 20px;">
          ${contentHtml}
        </td>
      </tr>
    </table>`;
}
