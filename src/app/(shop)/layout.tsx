import { Suspense } from "react";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { CookieConsentBanner } from "@/components/shop/cookie-consent";
import { BackToTop } from "@/components/shop/back-to-top";
import { AnnouncementBar } from "@/components/shop/announcement-bar";
import { VintedTcBanner } from "@/components/shop/vinted-tc-banner";
import { DevChatWidget } from "@/components/dev-chat/dev-chat-widget";
import { ReferralTracker } from "@/components/shop/referral-tracker";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <VintedTcBanner />
      <AnnouncementBar />
      <Header />
      <main id="main-content" className="flex-1">{children}</main>
      <Suspense>
        <Footer />
      </Suspense>
      <BackToTop />
      <CookieConsentBanner />
      <Suspense>
        <ReferralTracker />
      </Suspense>
      <Suspense>
        <DevChatWidget />
      </Suspense>
    </>
  );
}
