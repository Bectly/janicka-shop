/**
 * Boot-time env sanity check for R2 (Cloudflare images).
 *
 * Logs a single logger.warn when any required R2 env var is missing/empty.
 * Warn-only (never throws) so a misconfigured preview deploy stays visible
 * in Vercel function logs without breaking the build or runtime.
 *
 * Wired in via src/instrumentation.ts so it runs once per server boot.
 */

import { logger } from "@/lib/logger";

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
