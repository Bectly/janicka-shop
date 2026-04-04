import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/feed/"],
        disallow: ["/admin/", "/api/", "/checkout/", "/order/", "/cart/", "/search/"],
      },
      // Pinterest crawler — explicit access to catalog feed
      {
        userAgent: "Pinterest",
        allow: ["/", "/api/feed/pinterest"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
