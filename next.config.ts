import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
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

export default nextConfig;
