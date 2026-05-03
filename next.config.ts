import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const isDev = process.env.NODE_ENV === "development";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  // @libsql/client ships large native binaries per-platform; bundling all of
  // them into Vercel functions blows past the 300MB function size limit.
  // Mark as external so they're loaded at runtime from node_modules instead.
  serverExternalPackages: ["@libsql/client"],
  // #517 PERF-CSS-BLOCK: inline critical CSS (via beasties) so the 32KB
  // framework chunk stops render-blocking on mobile. Non-critical rules ship
  // async after first paint. Needed package is auto-picked-up by Next 16.
  experimental: {
    optimizeCss: true,
  },
  // Disable Next.js auto trailing-slash normalization so Czech→English aliases
  // collapse to a single 301 hop instead of "/produkty/" → "/produkty" → "/products".
  // Trailing slashes on other routes are normalized by the catch-all in redirects().
  skipTrailingSlashRedirect: true,
  images: {
    formats: ["image/avif", "image/webp"],
    // Allow finer-grained explicit quality= calls (default Next.js whitelist
    // is just [75]). Product images bypass /_next/image entirely via
    // unoptimized={true} now that nginx serves /uploads/* with CF Edge cache;
    // these qualities still apply to admin-curated banners (collection-hero,
    // category-hero, hero-section) which keep going through the optimizer.
    qualities: [25, 50, 75, 85, 90, 95, 100],
    remotePatterns: [
      {
        // Cloudflare R2 public bucket — janicka-shop-images (legacy, kept until
        // 7-day R2 cooldown elapses so historical URLs in indexes still resolve)
        protocol: "https",
        hostname: "pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev",
      },
      {
        // Phase 7 cutover: nginx /uploads/* serves from /opt/janicka-shop-images
        protocol: "https",
        hostname: "www.jvsatnik.cz",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "jvsatnik.cz",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "www.janicka-shop.cz",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "janicka-shop.cz",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "images1.vinted.net",
      },
      {
        protocol: "https",
        hostname: "images2.vinted.net",
      },
    ],
  },
  async redirects() {
    // Czech → English URL aliases. With skipTrailingSlashRedirect: true we must
    // match BOTH "/alias" and "/alias/" explicitly, otherwise trailing-slash
    // variants would fall through to the catch-all and cost two 301 hops.
    const czechAliases: Array<{ from: string; to: string }> = [
      { from: "/obchodni-podminky", to: "/terms" },
      { from: "/ochrana-soukromi", to: "/privacy" },
      { from: "/doprava", to: "/shipping" },
      { from: "/kontakt", to: "/contact" },
      { from: "/o-nas", to: "/about" },
      { from: "/reklamace", to: "/returns" },
      { from: "/vratky", to: "/returns" },
      { from: "/kosik", to: "/cart" },
      { from: "/produkty", to: "/products" },
      { from: "/gdpr", to: "/privacy" },
    ];
    const aliasRules = czechAliases.flatMap(({ from, to }) => [
      { source: from, destination: to, permanent: true },
      { source: `${from}/`, destination: to, permanent: true },
    ]);

    return [
      ...aliasRules,
      // Wishlist consolidation (#917): the legacy customer-only route is now a
      // 301 to the canonical /oblibene which serves both anon + logged-in users.
      {
        source: "/account/oblibene",
        destination: "/oblibene",
        permanent: true,
      },
      {
        source: "/account/oblibene/",
        destination: "/oblibene",
        permanent: true,
      },
      // Czech product detail slug + optional trailing slash → English canonical.
      {
        source: "/produkty/:slug*",
        destination: "/products/:slug*",
        permanent: true,
      },
      {
        source: "/produkty/:slug*/",
        destination: "/products/:slug*",
        permanent: true,
      },
      // Catch-all trailing-slash normalizer for every other route. Replaces the
      // built-in redirect we disabled via skipTrailingSlashRedirect so external
      // links with a stray "/" still canonicalize in a single hop.
      {
        source: "/:path+/",
        destination: "/:path+",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Cache-Control posture (added 2026-05-03):
    //   The shop now lives on Hetzner behind Cloudflare. The origin emits NO
    //   cache hints by default → CF returns DYNAMIC for every page → every
    //   visitor round-trips to Hetzner, no edge cache, no compounding hits.
    //
    //   Strategy:
    //   - Public catalog (/, /products, /products/[slug], /collections,
    //     /search) emits a short edge-tier TTL with a generous SWR window.
    //     Admin updates a product → existing revalidateTag("products")
    //     invalidates the in-memory "use cache" layer immediately; CF picks
    //     up the new HTML within 60s and serves stale-while-revalidate up
    //     to 5 min after.
    //   - Static-ish marketing pages (/about·/contact·/shipping·/returns·
    //     /terms·/privacy·sitemap·robots) cache for an hour at the edge.
    //   - All authenticated/per-user/write surfaces (/admin, /api, /account,
    //     /oblibene, /cart, /checkout, /login, /register, /reset-password,
    //     /verify-email-change, /order, /objednavka) emit explicit
    //     `private, no-store` so neither CF nor any intermediate proxy can
    //     ever cache one user's response into another's view.
    //   Order matters in headers(): private surfaces are listed FIRST so the
    //   broader public catch-alls don't accidentally widen them.
    // CATALOG_LIST_CACHE: 5min edge TTL + 10min SWR for catalog index pages
    // (homepage, /products, /collections, /category). Second-hand inventory is
    // low-write — admin add/edit fires revalidateTag("products") so CF picks up
    // changes within 5min anyway. Bumped from 60→300 in C5185 (perf task #967).
    // PDP (/products/:path*) and /search stay on the shorter PUBLIC_CACHE since
    // PDP product fields change more often and /search is per-query.
    const CATALOG_LIST_CACHE = "public, s-maxage=300, stale-while-revalidate=600";
    const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=300";
    const STATIC_PAGE_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";
    const PRIVATE_NEVER = "private, no-store, no-cache, must-revalidate";

    const cacheCatalogList = [{ key: "Cache-Control", value: CATALOG_LIST_CACHE }];
    const cachePublic = [{ key: "Cache-Control", value: PUBLIC_CACHE }];
    const cacheStatic = [{ key: "Cache-Control", value: STATIC_PAGE_CACHE }];
    const cachePrivate = [{ key: "Cache-Control", value: PRIVATE_NEVER }];

    return [
      // Private / per-user — listed first
      { source: "/admin/:path*", headers: cachePrivate },
      { source: "/api/:path*", headers: cachePrivate },
      { source: "/account/:path*", headers: cachePrivate },
      { source: "/oblibene", headers: cachePrivate },
      { source: "/oblibene/:path*", headers: cachePrivate },
      { source: "/cart", headers: cachePrivate },
      { source: "/cart/:path*", headers: cachePrivate },
      { source: "/checkout", headers: cachePrivate },
      { source: "/checkout/:path*", headers: cachePrivate },
      { source: "/login", headers: cachePrivate },
      { source: "/register", headers: cachePrivate },
      { source: "/reset-password", headers: cachePrivate },
      { source: "/reset-password/:path*", headers: cachePrivate },
      { source: "/verify-email-change", headers: cachePrivate },
      { source: "/order/:path*", headers: cachePrivate },
      { source: "/objednavka/:path*", headers: cachePrivate },
      // Static-ish marketing pages
      { source: "/about", headers: cacheStatic },
      { source: "/contact", headers: cacheStatic },
      { source: "/shipping", headers: cacheStatic },
      { source: "/returns", headers: cacheStatic },
      { source: "/returns/:path*", headers: cacheStatic },
      { source: "/terms", headers: cacheStatic },
      { source: "/privacy", headers: cacheStatic },
      { source: "/sitemap.xml", headers: cacheStatic },
      { source: "/robots.txt", headers: cacheStatic },
      // Catalog list pages — 5min edge TTL, 10min SWR (revalidateTag flushes on admin write)
      { source: "/", headers: cacheCatalogList },
      { source: "/products", headers: cacheCatalogList },
      { source: "/collections", headers: cacheCatalogList },
      { source: "/collections/:path*", headers: cacheCatalogList },
      { source: "/category/:path*", headers: cacheCatalogList },
      // PDP cache is now driven by `export const revalidate = 60` inside
      // src/app/(shop)/products/[slug]/page.tsx so Next.js can emit no-store
      // automatically for soft-404 responses (a blanket /products/:path* rule
      // here would override Next's 404 default and poison CF edge — Trace #958
      // F4). /search keeps its short PUBLIC_CACHE because it's per-query.
      { source: "/search", headers: cachePublic },
      // Security headers — apply to everything
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Analytics/marketing scripts: GA4, Pinterest Tag, Meta Pixel
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://widget.packeta.com https://www.googletagmanager.com https://s.pinimg.com https://connect.facebook.net`,
              "style-src 'self' 'unsafe-inline'",
              // img-src: R2 images + Vinted CDN + analytics beacon pixels (Meta, Pinterest)
              "img-src 'self' data: blob: https://pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev https://images1.vinted.net https://images2.vinted.net https://www.facebook.com https://ct.pinterest.com",
              "font-src 'self' data:",
              // connect-src: R2 uploads + GA4 data collection + Pinterest + Meta Pixel events
              "connect-src 'self' https://pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev https://payments.comgate.cz https://payments.comgate.eu https://widget.packeta.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://ct.pinterest.com https://www.facebook.com",
              "frame-src 'self' https://payments.comgate.cz https://payments.comgate.eu https://widget.packeta.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
