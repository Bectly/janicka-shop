/**
 * Boot-time env sanity checks.
 *
 * - checkR2Env: warn-only completeness check for R2 config.
 * - checkSiteUrlEnv: throws on whitespace / *.vercel.app preview host (re-export
 *   from site-url.ts).
 * - checkPublicUrlEnv: generic boot-time guard for URL-shaped NEXT_PUBLIC_*
 *   envs. Trims + asserts https?:// shape and refuses whitespace in prod.
 *   Defense-in-depth follow-on to #624 — a Vercel UI paste-error on R2 or APP
 *   URL would otherwise silently break product images / payment redirects /
 *   email links with no boot-time signal.
 *
 * Wired in via src/instrumentation.ts so it runs once per server boot.
 */

import { logger } from "@/lib/logger";
import { checkSiteUrlEnv } from "@/lib/site-url";

export { checkSiteUrlEnv };

type R2Var = {
  name: string;
  value: string | undefined;
  optionalIfPresent?: string; // sibling var that can satisfy the requirement
};

function isBlank(v: string | undefined): boolean {
  return v === undefined || v.trim() === "";
}

export function checkR2Env(): void {
  const publicUrl =
    process.env.R2_PUBLIC_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

  const required: R2Var[] = [
    { name: "R2_PUBLIC_URL (or NEXT_PUBLIC_R2_PUBLIC_URL)", value: publicUrl },
    { name: "R2_BUCKET_NAME", value: process.env.R2_BUCKET_NAME },
    { name: "R2_ACCOUNT_ID", value: process.env.R2_ACCOUNT_ID },
    { name: "R2_ACCESS_KEY_ID", value: process.env.R2_ACCESS_KEY_ID },
    { name: "R2_SECRET_ACCESS_KEY", value: process.env.R2_SECRET_ACCESS_KEY },
  ];

  const missing = required.filter((v) => isBlank(v.value)).map((v) => v.name);
  if (missing.length === 0) return;

  logger.warn(
    `[env-check] R2 config incomplete — uploads/deletes will fail or produce malformed URLs. Missing: ${missing.join(", ")}`
  );
}

function hasWhitespace(value: string): boolean {
  return /\s/.test(value);
}

const HTTP_URL_SHAPE = /^https?:\/\/[^\s]+$/;

export type PublicUrlEnvOptions = {
  /** If set, the URL's hostname must end with this suffix (e.g. ".r2.dev"). */
  requiredHostSuffix?: string;
  /** If true, a missing/empty value throws. Default: warn-only via getter. */
  requireSet?: boolean;
};

/**
 * Generic boot-time guard for URL-shaped NEXT_PUBLIC_* envs.
 *
 * In production, throws if the value contains whitespace, fails the https?://
 * shape check, or violates an optional host-suffix requirement. No-op in
 * development so local overrides (http://localhost) keep working.
 *
 * Returns silently if the env is unset (callers handle missing via fallback);
 * pass `requireSet: true` to upgrade missing-to-throw.
 */
export function checkPublicUrlEnv(
  name: string,
  options: PublicUrlEnvOptions = {}
): void {
  if (process.env.NODE_ENV !== "production") return;

  const raw = process.env[name];

  if (raw === undefined || raw === "") {
    if (options.requireSet) {
      throw new Error(
        `[env-check] ${name} is missing in production. Set it on Vercel.`
      );
    }
    return;
  }

  if (hasWhitespace(raw)) {
    throw new Error(
      `[env-check] ${name} contains whitespace/newline (${JSON.stringify(
        raw
      )}). Fix the env var on Vercel — trailing \\n or stray spaces silently break every URL built from this value.`
    );
  }

  if (!HTTP_URL_SHAPE.test(raw)) {
    throw new Error(
      `[env-check] ${name} is not a valid http(s) URL (${JSON.stringify(
        raw
      )}). Expected scheme http:// or https://.`
    );
  }

  if (options.requiredHostSuffix) {
    let hostname: string;
    try {
      hostname = new URL(raw).hostname;
    } catch {
      throw new Error(
        `[env-check] ${name} could not be parsed as a URL (${JSON.stringify(raw)}).`
      );
    }
    if (!hostname.endsWith(options.requiredHostSuffix)) {
      throw new Error(
        `[env-check] ${name} host ${hostname} does not end with required suffix ${options.requiredHostSuffix}.`
      );
    }
  }
}

/** Boot-time guard for NEXT_PUBLIC_R2_PUBLIC_URL (Cloudflare R2 public bucket). */
export function checkR2PublicUrlEnv(): void {
  checkPublicUrlEnv("NEXT_PUBLIC_R2_PUBLIC_URL");
}

/** Boot-time guard for NEXT_PUBLIC_APP_URL (used by Comgate redirects + email links). */
export function checkAppUrlEnv(): void {
  checkPublicUrlEnv("NEXT_PUBLIC_APP_URL");
}
