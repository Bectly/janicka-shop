/**
 * Phase 4 perf verification harness — Playwright-launched Chromium piped to
 * Lighthouse's programmatic API. Captures LCP/TBT/CLS/TTI/Performance score
 * per route.
 *
 * Why Playwright + Lighthouse (and not `npx lighthouse` CLI): Trace C4900
 * found that the three chromium binaries available on this machine crash
 * under the Lighthouse CLI with NO_FCP / Connection closed inside its own
 * chrome-launcher. Playwright ships its own Chromium and is known-good —
 * we just open a CDP port on it and hand the port to Lighthouse.
 *
 * Usage:
 *   npx tsx scripts/lighthouse-perf.ts \
 *     --base=https://jvsatnik.cz \
 *     --out=/tmp/phase4 \
 *     --tag=after \
 *     [--cookie='authjs.session-token=...; other=...'] \
 *     [--profile=desktop|mobile] \
 *     [--routes=/,/admin/dashboard,...]
 *
 * For authenticated admin/account routes pass `--cookie` with a valid NextAuth
 * session cookie string. Without it, the script still runs and the admin/account
 * routes will measure whatever the login redirect returns (useful as a floor).
 *
 * Output: {out}/{tag}-{route-slug}.json (full Lighthouse JSON) and
 *         {out}/{tag}-summary.json (compact metrics table).
 */

import { chromium, type Browser } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Lighthouse is ESM-only since v10; tsx transpiles the dynamic import fine.
type LighthouseFn = (
  url: string,
  flags: Record<string, unknown>,
  config?: unknown,
) => Promise<{
  lhr: {
    audits: Record<string, { numericValue?: number; score?: number | null }>;
    categories: { performance?: { score: number | null } };
    finalDisplayedUrl: string;
    runWarnings?: string[];
  };
} | undefined>;

const DEFAULT_ROUTES = [
  "/",
  "/admin/dashboard",
  "/admin/products",
  "/admin/orders",
  "/admin/mailbox",
  "/account",
] as const;

type Profile = "desktop" | "mobile";

type Args = {
  base: string;
  out: string;
  tag: string;
  cookie?: string;
  profile: Profile;
  routes: string[];
  debugPort: number;
};

type RouteMetrics = {
  route: string;
  finalUrl: string;
  perf: number | null;
  lcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  ttiMs: number | null;
  fcpMs: number | null;
  ttfbMs: number | null;
  warnings: string[];
  error?: string;
};

function parseArgs(argv: string[]): Args {
  const flags: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) flags[m[1]] = m[2];
  }
  const profile = (flags.profile ?? "desktop") as Profile;
  if (profile !== "desktop" && profile !== "mobile") {
    throw new Error(`--profile must be desktop or mobile (got ${profile})`);
  }
  return {
    base: flags.base ?? "http://localhost:3000",
    out: flags.out ?? "/tmp/phase4",
    tag: flags.tag ?? "run",
    cookie: flags.cookie,
    profile,
    routes: flags.routes ? flags.routes.split(",") : [...DEFAULT_ROUTES],
    debugPort: Number(flags.port ?? 9222),
  };
}

function slug(route: string): string {
  return route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "root";
}

function pickNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function runOne(
  lighthouse: LighthouseFn,
  config: unknown,
  url: string,
  opts: { port: number; cookie?: string },
): Promise<{ raw: unknown; metrics: Omit<RouteMetrics, "route"> }> {
  const flags: Record<string, unknown> = {
    port: opts.port,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance"],
  };
  if (opts.cookie) {
    flags.extraHeaders = { Cookie: opts.cookie };
  }
  const result = await lighthouse(url, flags, config);
  if (!result) throw new Error("lighthouse returned no result");
  const a = result.lhr.audits;
  return {
    raw: result.lhr,
    metrics: {
      finalUrl: result.lhr.finalDisplayedUrl,
      perf: result.lhr.categories.performance?.score ?? null,
      lcpMs: pickNumber(a["largest-contentful-paint"]?.numericValue),
      tbtMs: pickNumber(a["total-blocking-time"]?.numericValue),
      cls: pickNumber(a["cumulative-layout-shift"]?.numericValue),
      ttiMs: pickNumber(a["interactive"]?.numericValue),
      fcpMs: pickNumber(a["first-contentful-paint"]?.numericValue),
      ttfbMs: pickNumber(a["server-response-time"]?.numericValue),
      warnings: result.lhr.runWarnings ?? [],
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.out)) mkdirSync(args.out, { recursive: true });

  const [lhModule, desktopConfigModule] = await Promise.all([
    import("lighthouse"),
    import("lighthouse/core/config/desktop-config.js"),
  ]);
  const lighthouse = lhModule.default as LighthouseFn;
  const config =
    args.profile === "desktop"
      ? (desktopConfigModule.default ?? desktopConfigModule)
      : undefined; // undefined → lighthouse default (mobile Moto G Power)

  let browser: Browser | undefined;
  const summary: RouteMetrics[] = [];
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        `--remote-debugging-port=${args.debugPort}`,
        "--no-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    for (const route of args.routes) {
      const url = args.base.replace(/\/$/, "") + route;
      process.stdout.write(`[${args.tag}] ${args.profile} ${route} ... `);
      const started = Date.now();
      try {
        const { raw, metrics } = await runOne(lighthouse, config, url, {
          port: args.debugPort,
          cookie: args.cookie,
        });
        writeFileSync(
          resolve(args.out, `${args.tag}-${args.profile}-${slug(route)}.json`),
          JSON.stringify(raw, null, 2),
        );
        summary.push({ route, ...metrics });
        const ms = Date.now() - started;
        process.stdout.write(
          `OK perf=${metrics.perf ?? "?"} LCP=${metrics.lcpMs?.toFixed(0) ?? "?"}ms TBT=${metrics.tbtMs?.toFixed(0) ?? "?"}ms CLS=${metrics.cls?.toFixed(3) ?? "?"} TTI=${metrics.ttiMs?.toFixed(0) ?? "?"}ms (${ms}ms)\n`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stdout.write(`FAIL ${msg}\n`);
        summary.push({
          route,
          finalUrl: "",
          perf: null,
          lcpMs: null,
          tbtMs: null,
          cls: null,
          ttiMs: null,
          fcpMs: null,
          ttfbMs: null,
          warnings: [],
          error: msg,
        });
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  const summaryPath = resolve(args.out, `${args.tag}-${args.profile}-summary.json`);
  writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        base: args.base,
        tag: args.tag,
        profile: args.profile,
        capturedAt: new Date().toISOString(),
        authCookieProvided: Boolean(args.cookie),
        routes: summary,
      },
      null,
      2,
    ),
  );
  console.log(`\nSummary → ${summaryPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
