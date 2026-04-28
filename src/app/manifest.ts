import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Janička Shop",
    short_name: "Janička",
    description: "Výběrový second hand oblečení",
    id: "/",
    scope: "/",
    start_url: "/",
    display: "standalone",
    theme_color: "#f43f5e",
    background_color: "#ffffff",
    categories: ["shopping"],
    lang: "cs",
    dir: "ltr",
    orientation: "portrait",
    icons: [
      {
        src: "/logo/logo-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo/logo-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/logo/og-image.png",
        sizes: "1200x630",
        type: "image/png",
        form_factor: "wide",
      },
    ],
  };
}
