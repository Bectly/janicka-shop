import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

const BASE_URL = getSiteUrl();

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
