import { Suspense } from "react";
import { Header } from "@/components/shop/header";
import { Footer } from "@/components/shop/footer";
import { CookieConsentBanner } from "@/components/shop/cookie-consent";
import { BackToTop } from "@/components/shop/back-to-top";
import { AnnouncementBar } from "@/components/shop/announcement-bar";
import { DevChatWidget } from "@/components/dev-chat/dev-chat-widget";
import { ReferralTracker } from "@/components/shop/referral-tracker";
import { BottomNav } from "@/components/shop/bottom-nav";
import { PullToRefresh } from "@/components/shop/pull-to-refresh";

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
      <Suspense>
        <Footer />
      </Suspense>
      {/* Spacer for fixed bottom nav on mobile — matches nav height + device safe area */}
      <div
        className="lg:hidden h-[calc(3.5rem+env(safe-area-inset-bottom,_0px))]"
        aria-hidden="true"
      />
      <BackToTop />
      <CookieConsentBanner />
      <Suspense>
        <PullToRefresh />
      </Suspense>
      <Suspense>
        <BottomNav />
      </Suspense>
      <Suspense>
        <ReferralTracker />
      </Suspense>
      <Suspense>
        <DevChatWidget />
      </Suspense>
    </>
  );
}
