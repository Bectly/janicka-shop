/**
 * Central accessor for NEXT_PUBLIC_SITE_URL.
 *
 * Defense-in-depth against env-var typos: trims whitespace/newlines that have
 * silently broken GMC g:link, JSON-LD url, Pinterest TSV, sitemap, and robots
 * (#620). All callers must use getSiteUrl() instead of reading the env raw.
 *
 * Boot-time guard (checkSiteUrlEnv) refuses to start in production if the
 * value contains whitespace or points at a *.vercel.app preview host.
 */

import { logger } from "@/lib/logger";

const PROD_FALLBACK = "https://www.jvsatnik.cz";

let warnedOnce = false;

function isVercelPreviewHost(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function hasWhitespace(value: string): boolean {
  return /\s/.test(value);
}

/**
 * Returns the site's base URL, trimmed and validated.
 *
 * - Whitespace (incl. trailing \n) is stripped.
 * - In production, warns once if env is missing or dirty, then falls back.
 * - In development, allows localhost values without warning.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  const isProd = process.env.NODE_ENV === "production";

  if (raw === undefined || raw === "") {
    if (isProd && !warnedOnce) {
      warnedOnce = true;
      logger.warn(
        `[site-url] NEXT_PUBLIC_SITE_URL is missing in production — falling back to ${PROD_FALLBACK}`
      );
    }
    return isProd ? PROD_FALLBACK : "http://localhost:3000";
  }

  const trimmed = raw.trim();

  if (isProd && trimmed !== raw && !warnedOnce) {
    warnedOnce = true;
    logger.warn(
      `[site-url] NEXT_PUBLIC_SITE_URL contains whitespace — trimmed at runtime, but fix the env var on Vercel.`
    );
  }

  if (trimmed === "") {
    if (isProd && !warnedOnce) {
      warnedOnce = true;
      logger.warn(
        `[site-url] NEXT_PUBLIC_SITE_URL is whitespace-only — falling back to ${PROD_FALLBACK}`
      );
    }
    return isProd ? PROD_FALLBACK : "http://localhost:3000";
  }

  return trimmed;
}

/**
 * Boot-time check. Throws in production if the env value is unsafe.
 * Wired via src/lib/env-check.ts → src/instrumentation.ts.
 */
export function checkSiteUrlEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (raw === undefined || raw === "") return; // missing is warn-only via getSiteUrl

  if (hasWhitespace(raw)) {
    throw new Error(
      `[site-url] NEXT_PUBLIC_SITE_URL contains whitespace/newline (${JSON.stringify(
        raw
      )}). Fix the env var on Vercel — trailing \\n breaks every absolute URL (GMC g:link, JSON-LD, sitemap, robots).`
    );
  }

  if (isVercelPreviewHost(raw)) {
    throw new Error(
      `[site-url] NEXT_PUBLIC_SITE_URL points at a *.vercel.app preview host (${raw}). Production must use the canonical jvsatnik.cz domain.`
    );
  }
}
