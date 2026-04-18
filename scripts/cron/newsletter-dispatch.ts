/**
 * Hetzner cron: scheduled newsletter / one-off campaign dispatcher.
 *
 * Reads docs/migration/cron/campaigns.json — a versioned list of one-off
 * campaigns ({key, scheduledAt, endpoint, method, body}). For every campaign
 * whose scheduledAt is in the past and whose key has not been claimed in
 * CampaignSendLock, the dispatcher POSTs to the endpoint on the local
 * Next.js daemon and records the send via campaignSendLock.create.
 *
 * Idempotency:
 *   CampaignSendLock.campaignKey is the unique primary key. Two concurrent
 *   cron runs racing on the same campaign both attempt create; the loser
 *   gets P2002 and exits cleanly. Lock TTL is set to 365 days so a sent
 *   campaign is never re-dispatched by this script.
 *
 * Usage:
 *   tsx scripts/cron/newsletter-dispatch.ts          # live
 *   tsx scripts/cron/newsletter-dispatch.ts --dry    # print intended sends, no HTTP, no lock
 *
 * Env required:
 *   CRON_SECRET                       (bearer auth on internal endpoints)
 *   CRON_BASE_URL (optional)          (default http://127.0.0.1:3000)
 *   TURSO_DATABASE_URL + AUTH_TOKEN   (for lock writes; Prisma local fallback OK)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDb } from "../../src/lib/db";

const DRY = process.argv.includes("--dry");
const BASE = process.env.CRON_BASE_URL ?? "http://127.0.0.1:3000";
const CONFIG_PATH = resolve(__dirname, "../../docs/migration/cron/campaigns.json");
const LOCK_TTL_MS = 365 * 24 * 60 * 60 * 1000;

interface Campaign {
  key: string;
  label?: string;
  scheduledAt: string;
  endpoint: string;
  method?: "GET" | "POST";
  body?: unknown;
}

interface Config {
  campaigns: Campaign[];
}

function loadConfig(): Config {
  const raw = readFileSync(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw) as Config;
  if (!parsed?.campaigns || !Array.isArray(parsed.campaigns)) {
    throw new Error(`Invalid campaigns config at ${CONFIG_PATH}`);
  }
  return parsed;
}

async function alreadySent(
  db: Awaited<ReturnType<typeof getDb>>,
  key: string,
): Promise<boolean> {
  const lock = await db.campaignSendLock.findUnique({ where: { campaignKey: key } });
  return lock !== null;
}

async function dispatch(c: Campaign, secret: string): Promise<void> {
  const url = `${BASE}${c.endpoint}`;
  const method = c.method ?? "POST";
  const headers: Record<string, string> = {
    authorization: `Bearer ${secret}`,
  };
  let body: string | undefined;
  if (method !== "GET" && c.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(c.body);
  }

  const started = Date.now();
  const res = await fetch(url, { method, headers, body });
  const elapsed = Date.now() - started;
  const responseText = await res.text();

  if (!res.ok) {
    throw new Error(
      `${method} ${c.endpoint} → ${res.status} in ${elapsed}ms: ${responseText.slice(0, 400)}`,
    );
  }
  console.log(`[newsletter] ${c.key} sent in ${elapsed}ms`);
}

async function main(): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret && !DRY) {
    console.error("[newsletter] CRON_SECRET missing — refusing to run");
    process.exit(2);
  }

  const config = loadConfig();
  const now = Date.now();
  const due = config.campaigns.filter((c) => {
    const ts = Date.parse(c.scheduledAt);
    if (Number.isNaN(ts)) {
      console.error(`[newsletter] ${c.key} has invalid scheduledAt — skipping`);
      return false;
    }
    return ts <= now;
  });

  if (due.length === 0) {
    const next = config.campaigns
      .map((c) => ({ key: c.key, t: Date.parse(c.scheduledAt) }))
      .filter((c) => !Number.isNaN(c.t) && c.t > now)
      .sort((a, b) => a.t - b.t)[0];
    console.log(
      `[newsletter] no campaigns due${next ? ` — next: ${next.key} at ${new Date(next.t).toISOString()}` : ""}`,
    );
    return;
  }

  const db = await getDb();

  for (const c of due) {
    if (await alreadySent(db, c.key)) {
      continue; // already dispatched in a prior run
    }

    if (DRY) {
      console.log(
        `[newsletter] DRY — would dispatch ${c.key}: ${(c.method ?? "POST")} ${c.endpoint}` +
          (c.body ? ` body=${JSON.stringify(c.body)}` : ""),
      );
      continue;
    }

    // Claim the lock BEFORE the HTTP call. If the dispatch crashes mid-flight
    // we'd rather risk a missed re-send (alert via log) than a double-send to
    // every subscriber. Operator can manually delete the lock row to retry.
    try {
      await db.campaignSendLock.create({
        data: {
          campaignKey: c.key,
          claimedAt: new Date(),
          expiresAt: new Date(now + LOCK_TTL_MS),
        },
      });
    } catch (err: unknown) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2002") {
        // Another process claimed it concurrently — skip.
        continue;
      }
      throw err;
    }

    try {
      await dispatch(c, secret!);
    } catch (err) {
      console.error(`[newsletter] ${c.key} dispatch failed:`, err);
      // Lock stays — operator must delete to retry. Prevents partial-send re-runs.
      process.exitCode = 1;
    }
  }
}

main()
  .catch((err) => {
    console.error("[newsletter] crashed:", err);
    process.exit(1);
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref();
  });
