import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        // Cloudflare R2 public bucket — janicka-shop-images
        protocol: "https",
        hostname: "pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev",
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
    return [
      // Czech → English URL redirects for informational pages
      {
        source: "/obchodni-podminky",
        destination: "/terms",
        permanent: true,
      },
      {
        source: "/ochrana-soukromi",
        destination: "/privacy",
        permanent: true,
      },
      {
        source: "/doprava",
        destination: "/shipping",
        permanent: true,
      },
      {
        source: "/kontakt",
        destination: "/contact",
        permanent: true,
      },
      {
        source: "/o-nas",
        destination: "/about",
        permanent: true,
      },
      {
        source: "/reklamace",
        destination: "/returns",
        permanent: true,
      },
      {
        source: "/vratky",
        destination: "/returns",
        permanent: true,
      },
      {
        source: "/kosik",
        destination: "/cart",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
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
              "connect-src 'self' https://pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev https://payments.comgate.cz https://payments.comgate.eu https://widget.packeta.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://ct.pinterest.com https://www.facebook.com https://jarvis-janicka.jvsatnik.cz wss://jarvis-janicka.jvsatnik.cz",
              "frame-src 'self' https://payments.comgate.cz https://payments.comgate.eu https://widget.packeta.com https://jarvis-janicka.jvsatnik.cz",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
      {
        // SEC-3: admin JARVIS console embeds a cross-origin iframe —
        // suppress the Referer entirely so the tunnel can't learn admin pathnames.
        // Must come AFTER the catch-all so this value wins on header merge.
        source: "/admin/jarvis",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
