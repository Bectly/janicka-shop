import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://jvsatnik.cz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/feed/"],
        disallow: ["/admin/", "/api/", "/checkout/", "/order/", "/cart/", "/search/", "/pick-logo/"],
      },
      // Pinterest crawler — explicit access to catalog feed; disallow admin/sensitive paths
      {
        userAgent: "Pinterest",
        allow: ["/", "/api/feed/pinterest"],
        disallow: ["/admin/", "/api/", "/checkout/", "/order/", "/cart/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
