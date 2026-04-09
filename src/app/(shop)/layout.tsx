export const revalidate = 3600; // 1h — layout (header/footer) rarely changes

import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { CookieConsentBanner } from "@/components/shop/cookie-consent";
import { BackToTop } from "@/components/shop/back-to-top";
import { AnnouncementBar } from "@/components/shop/announcement-bar";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
      <BackToTop />
      <CookieConsentBanner />
    </>
  );
}
