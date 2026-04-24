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
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="${align}" style="margin: 0 ${align === "center" ? "auto" : "0"};">
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
  footerNote?: string;
  showTagline?: boolean;
  lang?: string;
}

/**
 * Full email HTML shell — doctype → head → preheader → branded header →
 * white content card → brand footer. Content card is 600px, fluid on mobile.
 */
export function renderLayout({
  preheader,
  contentHtml,
  unsubscribeUrl,
  footerNote,
  showTagline = true,
  lang = "cs",
}: LayoutOpts): string {
  const baseUrl = getBaseUrl();
  const logoUrl = `${baseUrl}/logo/logo-email.png`;

  const preheaderHtml = preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: ${BRAND.pageBg}; opacity: 0;">${escapeHtml(preheader)}</div>`
    : "";

  const unsubscribeHtml = unsubscribeUrl
    ? `<p style="margin: 12px 0 0; font-family: ${FONTS.sans}; font-size: 11px; color: ${BRAND.charcoalMuted}; line-height: 1.6;">Tenhle email ti chodí, protože ses přihlásila k odběru novinek. <a href="${escapeHtml(unsubscribeUrl)}" style="color: ${BRAND.charcoalSoft}; text-decoration: underline;">Odhlásit se</a></p>`
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
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a { font-family: Georgia, 'Times New Roman', serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; width: 100%; background: ${BRAND.pageBg}; font-family: ${FONTS.sans}; color: ${BRAND.charcoal}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: ${BRAND.pageBg};">
    <tr>
      <td align="center" style="padding: 24px 12px 48px;">

        <!-- Container -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding: 24px 16px 20px;">
              <a href="${baseUrl}" style="text-decoration: none; display: inline-block;">
                <img src="${logoUrl}" alt="Janička Shop" width="140" style="display: block; margin: 0 auto; height: auto; max-height: 56px; width: auto; max-width: 180px; border: 0; outline: none;" />
              </a>
              ${showTagline ? `<p style="margin: 12px 0 0; font-family: ${FONTS.serif}; font-size: 13px; font-style: italic; color: ${BRAND.primary}; letter-spacing: 0.12em; text-transform: uppercase;">Second hand s láskou</p>` : ""}
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td style="background: ${BRAND.white}; border-radius: 20px; padding: 40px 32px; box-shadow: 0 1px 2px rgba(58, 48, 52, 0.04), 0 8px 24px rgba(184, 64, 122, 0.06); border: 1px solid ${BRAND.borderSoft};">
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
            <td align="center" style="padding: 8px 16px 24px;">
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
  return `<p style="margin: 0 0 6px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: ${BRAND.primary};">${escapeHtml(text)}</p>`;
}

/** Serif display heading — used once at top of card. */
export function renderDisplayHeading(text: string): string {
  return `<h1 style="margin: 0 0 16px; font-family: ${FONTS.serif}; font-size: 30px; font-weight: 600; line-height: 1.15; letter-spacing: -0.01em; color: ${BRAND.charcoal};">${escapeHtml(text)}</h1>`;
}

/** Body paragraph — default copy style. */
export function renderBody(text: string): string {
  return `<p style="margin: 0 0 14px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">${text}</p>`;
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
