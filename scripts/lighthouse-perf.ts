/**
 * Phase 4 perf verification harness — Playwright-bundled Chromium binary
 * launched via chrome-launcher, piped to Lighthouse's programmatic API.
 * Captures LCP/TBT/CLS/TTI/Performance score per route.
 *
 * Why this shape (C4900/C4901 context): Trace's Lighthouse-CLI runs crashed
 * with NO_FCP against every system chromium binary on this box. First Bolt
 * attempt here used `playwright.chromium.launch({args:[--remote-debugging-port]})`
 * and Lighthouse attached to the same port — that ALSO crashed with NO_FCP
 * because Playwright's own CDP client and Lighthouse's target manager both
 * owned the same browser and fought over the first tab (Lighthouse ended up
 * stuck on `about:blank`). Final shape: use chrome-launcher (Lighthouse's
 * canonical pairing) but point it at Playwright's full Chromium binary via
 * `chromePath`. Lighthouse gets exclusive ownership of a known-good
 * Chromium while still satisfying the "use Playwright chromium" directive.
 *
 * Usage:
 *   xvfb-run -a npx tsx scripts/lighthouse-perf.ts \
 *     --base=https://jvsatnik.cz \
 *     --out=/tmp/phase4 \
 *     --tag=after \
 *     [--cookie='authjs.session-token=...; other=...'] \
 *     [--profile=desktop|mobile] \
 *     [--routes=/,/admin/dashboard,...] \
 *     [--headless=false]
 *
 * IMPORTANT on headless: Chromium's classic `--headless` mode does not emit
 * paint events Lighthouse needs (reliable NO_FCP). The launcher requests
 * `--headless=new` by default. On a display-less box, wrap the command in
 * `xvfb-run -a`; add `--headless=false` to force a real windowed run.
 *
 * For authenticated admin/account routes pass `--cookie` with a valid NextAuth
 * session cookie string. Without it, the script still runs and the admin/account
 * routes will measure whatever the login redirect returns (useful as a floor).
 *
 * Output: {out}/{tag}-{profile}-{route-slug}.json (full Lighthouse JSON) and
 *         {out}/{tag}-{profile}-summary.json (compact metrics table).
 */

import { launch as launchChrome, type LaunchedChrome } from "chrome-launcher";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

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
    runtimeError?: { code: string; message: string };
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
  headless: boolean;
  chromePath?: string;
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
    headless: flags.headless !== "false",
    chromePath: flags["chrome-path"],
  };
}

function slug(route: string): string {
  return route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "root";
}

function pickNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function detectPlaywrightChromium(): string | undefined {
  // Best-effort: locate the full (non-headless_shell) Playwright Chromium
  // binary. Falls back to chrome-launcher's own detection if not found.
  const req = createRequire(import.meta.url);
  try {
    const pwPath = req.resolve("playwright");
    const pkgRoot = pwPath.replace(/\/lib\/.*$/, "");
    void pkgRoot; // currently unused; Playwright >=1.50 stores browsers in PLAYWRIGHT_BROWSERS_PATH
  } catch {
    // ignore
  }
  const candidates = [
    `${process.env.HOME}/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome`,
    `${process.env.HOME}/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`,
  ];
  for (const c of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { statSync } = req("node:fs") as typeof import("node:fs");
      statSync(c);
      return c;
    } catch {
      // try next
    }
  }
  return undefined;
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
  const runtimeErr = result.lhr.runtimeError;
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
      error: runtimeErr ? `${runtimeErr.code}: ${runtimeErr.message}` : undefined,
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

  const chromePath = args.chromePath ?? detectPlaywrightChromium();
  console.log(
    `chrome binary: ${chromePath ?? "(chrome-launcher auto-detect)"}; headless: ${args.headless}`,
  );

  let chrome: LaunchedChrome | undefined;
  const summary: RouteMetrics[] = [];
  try {
    chrome = await launchChrome({
      chromePath,
      chromeFlags: [
        args.headless ? "--headless=new" : "",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ].filter(Boolean),
    });

    for (const route of args.routes) {
      const url = args.base.replace(/\/$/, "") + route;
      process.stdout.write(`[${args.tag}] ${args.profile} ${route} ... `);
      const started = Date.now();
      try {
        const { raw, metrics } = await runOne(lighthouse, config, url, {
          port: chrome.port,
          cookie: args.cookie,
        });
        writeFileSync(
          resolve(args.out, `${args.tag}-${args.profile}-${slug(route)}.json`),
          JSON.stringify(raw, null, 2),
        );
        summary.push({ route, ...metrics });
        const ms = Date.now() - started;
        process.stdout.write(
          `perf=${metrics.perf ?? "?"} LCP=${metrics.lcpMs?.toFixed(0) ?? "?"}ms TBT=${metrics.tbtMs?.toFixed(0) ?? "?"}ms CLS=${metrics.cls?.toFixed(3) ?? "?"} TTI=${metrics.ttiMs?.toFixed(0) ?? "?"}ms (${ms}ms)${metrics.error ? " [" + metrics.error + "]" : ""}\n`,
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
    if (chrome) await chrome.kill();
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
        chromePath: chromePath ?? "(chrome-launcher auto-detect)",
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
