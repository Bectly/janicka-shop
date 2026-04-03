---
name: cycle36_auth_security_audit
description: Cycle #36 targeted audit — auth.ts, middleware.ts, rate-limit.ts, db.ts, cookie-consent, sitemap, robots, next.config.ts, checkout/actions.ts. New findings only.
type: project
---

Audit scope: src/lib/auth.ts, src/middleware.ts, src/lib/rate-limit.ts, src/lib/db.ts, src/app/api/auth/[...nextauth]/route.ts, src/app/(admin)/admin/login/page.tsx, src/app/(admin)/admin/layout.tsx, src/lib/visitor.ts, src/app/layout.tsx, src/app/(shop)/layout.tsx, src/components/shop/cookie-consent.tsx, src/components/shop/footer.tsx, src/app/sitemap.ts, src/app/robots.ts, next.config.ts, src/app/api/payments/comgate/route.ts, src/app/api/uploadthing/core.ts, src/app/(shop)/checkout/actions.ts.

## Confirmed still-open from prior audits (NOT re-reported)
- HIGH: in-memory rate limiter non-functional on Vercel (login brute-force)
- MEDIUM: no admin rate limiting
- MEDIUM: Comgate webhook no IP allowlist/signature
- LOW: accessToken null-bypass guard
- LOW: admin pagination
- LOW: reservedBy index missing
- LOW: JWT maxAge not set (30-day default)

## New Findings — Cycle #36

### MEDIUM — No Content-Security-Policy header anywhere
- File: next.config.ts (lines 13-25)
- next.config.ts sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy. CSP is absent. Without CSP, XSS has no second-line defence — any injected script runs unrestricted. This matters especially on the admin panel which renders user-controlled product names/descriptions.
- Fix: Add a `Content-Security-Policy` header to the headers() array. Minimum viable: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://*.ufs.sh data:; connect-src 'self'`. Tighten once analytics/Comgate SDK sources are known.

### MEDIUM — Middleware only protects /admin/:path* — API routes are unprotected by middleware
- File: src/middleware.ts (line 4: `matcher: ["/admin/:path*"]`)
- The auth middleware does not cover /api/. Routes under /api/ (including /api/payments/comgate/, /api/uploadthing/) rely entirely on in-route auth checks. The uploadthing core correctly calls auth() inside middleware. The Comgate webhook is intentionally public (correct). However, any future API route added without explicit auth will be silently unprotected — there is no fallback layer.
- Risk level depends on future additions. Current state is safe, but the pattern is fragile.
- Fix: Either expand the matcher to also cover `/api/(admin|protected)/:path*` for admin-specific API routes, or document this as a known architectural decision so future routes don't accidentally omit auth.

### MEDIUM — Auth rate limiting fires before email/password validation, consuming limit on empty submissions
- File: src/lib/auth.ts (lines 15-19)
- Order: `if (!credentials?.email || !credentials?.password) return null;` — THEN `rateLimitLogin()`. Wait: actually the null check is on line 15-16, BEFORE the rate limit on line 18. This is correct ordering. However: the rate limit counts every attempt including valid ones. A successful login from a legitimate user still burns one of the 5 slots per 15 minutes on that IP. If the admin is behind NAT/shared office IP, a colleague's failed attempt from the same IP eats into the admin's limit.
- This is the inherent tradeoff of IP-based rate limiting with a tight limit; worth noting. The limit of 5 per 15 min is quite tight for a shared office environment.
- Fix: Consider raising to 10/15min, or add email-based counting in addition to IP-based (count `login:email:{email}` separately from `login:ip:{ip}`).

### LOW — cookie-consent: consent stored only in localStorage, not in HttpOnly cookie
- File: src/components/shop/cookie-consent.tsx (lines 26-30)
- Consent preferences (analytics, marketing toggles) are stored in localStorage. The server receives only a boolean `cookie-consent=1` cookie (line 30) — no granular preferences. If the server ever needs to know whether analytics is consented (e.g. to decide whether to fire a server-side tracking event), it cannot differentiate. The `cookie-consent=1` value conveys only "banner was dismissed", not "analytics was consented".
- ÚOOÚ compliance: the granular consent signal is only in localStorage, which is inaccessible server-side. If any server-side analytics is ever added, this architecture requires re-evaluation.
- Fix: Set a cookie with the full consent object (e.g. `cookie-consent={"a":1,"m":0}`) so server actions can inspect actual preferences.

### LOW — cookie-consent: XSS could read consent from localStorage
- File: src/components/shop/cookie-consent.tsx (line 18: `localStorage.getItem(CONSENT_KEY)`)
- localStorage is accessible to any JS running on the page (unlike HttpOnly cookies). If an XSS is present elsewhere in the shop, the consent record is readable and writable, allowing an attacker to silently re-enable marketing cookies. This is inherent to localStorage-only consent storage.
- Fix: Use HttpOnly server-set cookies for the consent record (server-authoritative) with client UI updating via POST to a /api/consent endpoint.

### LOW — sitemap.ts: no error handling — DB failure returns 500 on /sitemap.xml
- File: src/app/sitemap.ts (lines 8-16)
- The sitemap function calls prisma.product.findMany and prisma.category.findMany with no try-catch. If the DB is temporarily unreachable (Turso latency spike on cold start), Next.js will render an unhandled error page for /sitemap.xml. Crawlers that hit a 500 on sitemap may mark the entire sitemap as broken and delay re-crawl.
- Fix: Wrap in try-catch; on error return just the static pages (safe degradation).

### LOW — robots.ts: /checkout is disallowed without trailing slash, /order/ has trailing slash — inconsistent
- File: src/app/robots.ts (line 12: `disallow: ["/admin/", "/api/", "/checkout", "/order/"]`)
- `/checkout` without trailing slash only disallows exactly that URL; `/checkout/` (the actual path) and `/checkout/payment-return` are technically allowed by some crawlers that interpret the rule strictly. In practice, most crawlers treat `/checkout` as matching the prefix, but the inconsistency with `/admin/` (has trailing slash) and `/order/` (has trailing slash) is a potential gap.
- Fix: Add trailing slash for consistency: `"/checkout/"`.

### LOW — login page: no client-side rate limit feedback or lockout indication
- File: src/app/(admin)/admin/login/page.tsx (lines 28-30)
- When the server-side rate limit is hit, `result?.error` is truthy and the UI shows "Nesprávný email nebo heslo" — the same message as a wrong password. There is no indication to the legitimate admin that they are locked out vs. typed the wrong password, which can be confusing (legitimate admin may keep trying and extend their own lockout window if a user-specific limiter is later added).
- Fix: NextAuth allows returning a custom error code. Differentiate between "CredentialsSignin" (wrong password) and a rate-limit error code so the UI can display "Příliš mnoho pokusů, zkuste za 15 minut."

### LOW — Prisma client: no connection pool / query timeout configured for Turso production
- File: src/lib/db.ts (lines 6-7: `new PrismaClient()` with no options)
- PrismaClient is created with default settings. For Turso (libsql over HTTP/WebSocket), there is no connection pool timeout or query timeout configured. A slow DB response hangs the server action indefinitely (Node.js timeout depends on Vercel function timeout, currently 10s on hobby). Fine at low traffic but worth explicitly setting `datasources` or the libsql client timeout for production resilience.
- Note: this requires the Turso adapter (@prisma/adapter-libsql) which is not yet in package.json — currently running SQLite locally. Revisit when Turso is connected.

**Why:** No new HIGH findings. Most critical ongoing gap remains the in-memory rate limiter on Vercel (HIGH, carry-over). New MEDIUM gap is missing CSP header — admin renders user-controlled content (product names) and CSP is the primary XSS mitigation layer.

**How to apply:** Next Bolt cycle priority: (1) Add CSP header to next.config.ts — low-effort, high-impact, (2) Middleware matcher expansion for future-proofing, (3) sitemap error handling (SEO protection).
