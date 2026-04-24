import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { RouteAnnouncer } from "@/components/route-announcer";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

// CRITICAL: without this, mobile Chrome/Safari render the page at the
// default 980px desktop viewport and scale down to fit, producing horizontal
// overflow on every page (bectly 2026-04-24: "v košíku nevidím pravou část
// po kliknutí na Pokračovat" — reproducible on every phone/browser because
// the whole site was missing the tag, not a checkout-specific bug).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale: 1 would disable pinch-zoom — bad for accessibility, don't.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Janička — Móda pro moderní ženy",
    template: "%s | Janička",
  },
  description:
    "Objevte stylové oblečení pro každou příležitost. Šaty, topy, kalhoty, bundy a doplňky s rychlým doručením po celé ČR.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://janicka-shop.vercel.app"
  ),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/logo/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    siteName: "Janička",
    images: [
      {
        url: "/logo/og-image.png",
        width: 1200,
        height: 630,
        alt: "Janička — Second hand móda pro moderní ženy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/logo/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className={`${inter.variable} ${cormorant.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="skip-to-content"
        >
          Přejít na obsah
        </a>
        <Suspense>
          <RouteAnnouncer />
        </Suspense>
        <Suspense>
          <AnalyticsProvider />
        </Suspense>
        <Analytics />
        <SpeedInsights />
        {children}
      </body>
    </html>
  );
}
