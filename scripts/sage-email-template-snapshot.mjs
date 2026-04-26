#!/usr/bin/env node
// Sage C4958 #616 — Email-template visual snapshot grid.
//
// Captures every BRAND-PASSED template (14 keys per
// docs/audits/email-brand-pass-2026-04-25.md tally) at desktop 600px and
// mobile 375px viewports → 28 PNGs total. Output baseline lives at
// docs/visual-audits/email-templates-2026-04-26/.
//
// Auth: NextAuth credentials login at /admin/login using E2E_ADMIN_EMAIL
// + E2E_ADMIN_PASSWORD env (seeded admin user). Skips with non-zero exit
// if either is missing AND no SAGE_ADMIN_COOKIE is provided. The admin
// preview endpoint hard-fails on session.user.role !== "admin" so an
// unauthenticated run produces only a JSON error PNG — be sure auth
// landed before treating the grid as a true visual baseline.
//
// Usage:
//   E2E_ADMIN_EMAIL=admin@... E2E_ADMIN_PASSWORD=... \
//     SAGE_BASE_URL=http://localhost:3000 \
//     node scripts/sage-email-template-snapshot.mjs
//
// Env:
//   SAGE_BASE_URL         default http://localhost:3000 — point at dev
//                         server (`npm run dev`) with a seeded admin user.
//   E2E_ADMIN_EMAIL       admin login (NextAuth credentials).
//   E2E_ADMIN_PASSWORD    admin login password.
//   SAGE_ADMIN_COOKIE     OPTIONAL — pre-baked NextAuth session cookie
//                         (name=value) to skip the login form (e.g. for
//                         Vercel preview where the seeded admin lives in
//                         Turso). Format: "next-auth.session-token=..."
//                         or "__Secure-next-auth.session-token=...".

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');

const BASE = process.env.SAGE_BASE_URL || 'http://localhost:3000';
const OUT = resolve(REPO, 'docs/visual-audits/email-templates-2026-04-26');

// 14 BRAND-PASSED templates per docs/audits/email-brand-pass-2026-04-25.md
// tally (line 50). Order matches the audit's send-path table for diff
// readability (transactional → post-purchase → marketing → account).
const TEMPLATES = [
  { key: 'order-confirmation',     group: 'Objednávka', label: 'Potvrzení objednávky (Comgate)' },
  { key: 'shipping-notification',  group: 'Objednávka', label: 'Expedice + cross-sell' },
  { key: 'order-delivered',        group: 'Objednávka', label: 'Doručeno' },
  { key: 'delivery-check',         group: 'Po nákupu',  label: 'Kontrola doručení (ship+4d)' },
  { key: 'review-request',         group: 'Po nákupu',  label: 'Žádost o hodnocení (ship+7d)' },
  { key: 'cross-sell-followup',    group: 'Po nákupu',  label: 'Cross-sell (T+14d)' },
  { key: 'newsletter-welcome',     group: 'Marketing',  label: 'Vítej v newsletteru' },
  { key: 'new-arrival',            group: 'Marketing',  label: 'Novinky' },
  { key: 'browse-abandonment',     group: 'Marketing',  label: 'Browse abandonment' },
  { key: 'abandoned-cart-1',       group: 'Marketing',  label: 'Opuštěný košík #1 (30-60 min)' },
  { key: 'abandoned-cart-2',       group: 'Marketing',  label: 'Opuštěný košík #2 (12-24 h)' },
  { key: 'abandoned-cart-3',       group: 'Marketing',  label: 'Opuštěný košík #3 (48-72 h)' },
  { key: 'win-back',               group: 'Marketing',  label: 'Win-back (30+ dní)' },
  { key: 'account-welcome',        group: 'Účet',       label: 'Vítej v účtu (registrace)' },
];

// 600 = canonical email body width (Litmus / Mailchimp default container).
// 375 = iPhone SE / 8 / X / 11 / 12 mini base — covers the 60% of CZ users
// on ≤390px-wide phones per our Vercel field data.
const VIEWPORTS = [
  { name: 'desktop-600', width: 600,  height: 900 },
  { name: 'mobile-375',  width: 375,  height: 800 },
];

function fail(msg, code = 1) {
  console.error(`[sage-email-snapshot] ${msg}`);
  process.exit(code);
}

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const adminCookie = process.env.SAGE_ADMIN_COOKIE;

if (!adminCookie && (!adminEmail || !adminPassword)) {
  fail('require E2E_ADMIN_EMAIL+E2E_ADMIN_PASSWORD or SAGE_ADMIN_COOKIE');
}

mkdirSync(OUT, { recursive: true });

async function loginAsAdmin(context) {
  if (adminCookie) {
    const [name, ...rest] = adminCookie.split('=');
    const value = rest.join('=');
    const host = new URL(BASE).hostname;
    await context.addCookies([
      { name, value, domain: host, path: '/', httpOnly: true, sameSite: 'Lax', secure: BASE.startsWith('https://') },
    ]);
    return;
  }
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await Promise.all([
      page.waitForURL(/\/admin\/dashboard/, { timeout: 20_000 }),
      page.click('button[type="submit"]'),
    ]);
  } finally {
    await page.close();
  }
}

async function snapshotTemplate(context, template, viewport) {
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const url = `${BASE}/api/admin/email-preview?template=${encodeURIComponent(template.key)}`;
  const file = `${template.key}__${viewport.name}.png`;
  const path = resolve(OUT, file);
  let status = 0;
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
    status = resp?.status() ?? 0;
    // Hint email-rendered fonts/imgs into a settled paint before capture.
    await page.waitForTimeout(400);
    await page.screenshot({ path, fullPage: true });
  } catch (err) {
    console.error(`[snapshot] ${template.key}/${viewport.name} failed: ${err.message}`);
  } finally {
    await page.close();
  }
  return { template: template.key, viewport: viewport.name, file, status, path };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'cs-CZ' });

const results = [];
try {
  await loginAsAdmin(context);
  for (const t of TEMPLATES) {
    for (const vp of VIEWPORTS) {
      const r = await snapshotTemplate(context, t, vp);
      console.log(`${r.status === 200 ? 'OK ' : 'WARN'} ${r.template} ${r.viewport} -> ${r.file} (status ${r.status})`);
      results.push(r);
    }
  }
} finally {
  await context.close();
  await browser.close();
}

writeFileSync(
  resolve(OUT, 'snapshots.json'),
  JSON.stringify({ base: BASE, capturedAt: new Date().toISOString(), results }, null, 2),
);

const failed = results.filter((r) => r.status !== 200);
if (failed.length) {
  console.error(`[sage-email-snapshot] ${failed.length}/${results.length} captures non-200 — check auth + dev server logs`);
  process.exit(2);
}
console.log(`[sage-email-snapshot] captured ${results.length}/${TEMPLATES.length * VIEWPORTS.length} → ${OUT}`);
