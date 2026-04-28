import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f43f5e",
};

export const metadata: Metadata = {
  title: "Janička Admin — Mobil",
  manifest: "/admin-mobile.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Janička Admin",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/logo/logo-192.png",
  },
  robots: { index: false, follow: false },
};

export default function DraftsMobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
