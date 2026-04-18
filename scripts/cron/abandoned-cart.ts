/**
 * Hetzner cron: abandoned cart 3-email sequence dispatcher.
 *
 * Thin HTTP wrapper around /api/cron/abandoned-carts — the Next.js route
 * already implements the 45min / 18h / 60h timing, GDPR consent gate, and
 * sold-item fallback. Running it via HTTP keeps a single source of truth
 * (shared with Vercel fallback) and avoids spinning up a second Prisma
 * client from cron.
 *
 * Usage (crontab): every 15 min via /etc/cron.d/janicka-shop.
 *   /usr/bin/tsx scripts/cron/abandoned-cart.ts
 *   /usr/bin/tsx scripts/cron/abandoned-cart.ts --dry   # prints planned action, no HTTP call
 *
 * Env required:
 *   CRON_SECRET          — bearer token expected by the endpoint
 *   CRON_BASE_URL        — defaults to http://127.0.0.1:3000 (local PM2 daemon)
 */

const DRY = process.argv.includes("--dry");
const BASE = process.env.CRON_BASE_URL ?? "http://127.0.0.1:3000";
const PATH = "/api/cron/abandoned-carts";

async function main(): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[abandoned-cart] CRON_SECRET missing — refusing to run");
    process.exit(2);
  }

  const url = `${BASE}${PATH}`;

  if (DRY) {
    console.log(`[abandoned-cart] DRY — would GET ${url} with bearer auth`);
    console.log(`[abandoned-cart] DRY — expected action: scan AbandonedCart, send email 1 (45m), 2 (18h), 3 (60h), expire at 7d`);
    return;
  }

  const started = Date.now();
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${secret}` },
  });
  const elapsed = Date.now() - started;
  const body = await res.text();

  if (!res.ok) {
    console.error(`[abandoned-cart] ${res.status} in ${elapsed}ms: ${body}`);
    process.exit(1);
  }
  console.log(`[abandoned-cart] ok in ${elapsed}ms: ${body}`);
}

main().catch((err) => {
  console.error("[abandoned-cart] crashed:", err);
  process.exit(1);
});
