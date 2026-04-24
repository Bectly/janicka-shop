import { cookies } from "next/headers";
import { CookieConsentBannerClient } from "./cookie-consent-client";

export type { CookieConsent } from "./cookie-consent-client";

/**
 * Server wrapper for the cookie-consent banner. Reading the `cookie-consent`
 * cookie on the server lets us render the banner markup in the initial HTML
 * (SSR) when the visitor has not consented yet — so the banner paints at FCP
 * time instead of popping in post-hydration and hijacking LCP on mobile.
 *
 * The client shell is always mounted so it can react to the
 * "show-cookie-consent" event from the footer settings link even after the
 * banner has been dismissed.
 */
export async function CookieConsentBanner() {
  const cookieStore = await cookies();
  const hasConsent = cookieStore.has("cookie-consent");
  return <CookieConsentBannerClient initialVisible={!hasConsent} />;
}
