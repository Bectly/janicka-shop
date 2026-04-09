import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RouteAnnouncer } from "@/components/route-announcer";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Janička — Móda pro moderní ženy",
    template: "%s | Janička",
  },
  description:
    "Objevte stylové oblečení pro každou příležitost. Šaty, topy, kalhoty, bundy a doplňky s rychlým doručením po celé ČR.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
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
    <html lang="cs" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="skip-to-content"
        >
          Přejít na obsah
        </a>
        <RouteAnnouncer />
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}
