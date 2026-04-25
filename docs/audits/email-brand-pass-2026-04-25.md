# Email Brand-Pass Audit — 2026-04-25

**Auditor**: Sage (DevLoop cycle #4919, task #568)
**Target**: `src/lib/email.ts` (2991 lines)
**Layout helpers**: `src/lib/email/layout.ts` (533 lines) — `renderLayout`, `renderEyebrow`, `renderDisplayHeading`, `renderButton`, `renderInfoCard`, `renderProductGrid`, `renderProductRowList`, `renderAboutValues`, `renderShopLink`, `BRAND`, `FONTS`

## Classification key

| Status | Meaning |
| --- | --- |
| **BRAND-PASSED** | Wraps content in `renderLayout`, uses `BRAND` tokens + `FONTS` consistently, AND includes the `renderAboutValues` + `renderShopLink` polish block where it makes brand-narrative sense (transactional/marketing customer-facing, post-purchase). |
| **PARTIAL** | Wraps content in `renderLayout` and uses tokens, but skips polish helpers where they would reinforce brand pillars (e.g. has `renderProductGrid` but no `renderAboutValues` footer). |
| **INLINE-LEGACY** | Bypasses `renderLayout` entirely, raw HTML string with no shared shell. |
| **INTERNAL-OK** | Admin-only or security-only template — `renderLayout` + tokens are sufficient; brand pillars footer would be inappropriate (admin alert; password reset; account-deleted). |

## Send / Preview function table

| # | Function | Line | Builder | Status | Gap summary |
| - | -------- | ---- | ------- | ------ | ----------- |
| 1 | `sendOrderConfirmationEmail` | 256 | `buildOrderConfirmationHtml` (81) | **BRAND-PASSED** | Uses `renderLayout` + `renderShopLink` (204) + `renderAboutValues` (209). |
| 2 | `sendPaymentConfirmedEmail` | 280 | `buildPaymentConfirmedHtml` (218) | INTERNAL-OK | Tight transactional confirm; polish would dilute the receipt focus. |
| 3 | `sendOrderStatusEmail (confirmed)` | 417 | `buildOrderConfirmedHtml` via `buildStatusEmailWrapper` (319) | INTERNAL-OK | Status-update wrapper; intentionally minimal. |
| 4 | `sendOrderStatusEmail (shipped)` | 417 | `buildOrderShippedHtml` (354) | INTERNAL-OK | Same wrapper. |
| 5 | `sendOrderStatusEmail (delivered)` | 417 | `buildOrderDeliveredHtml` (374) | **BRAND-PASSED** _(C4923)_ | **CONVERTED in C4923 #571**: bypassed `buildStatusEmailWrapper` (status wrapper has no slot after the primary button) and inlined an equivalent layout that appends `renderShopLink("Prohlédnout další kousky")` + `renderAboutValues()` after the order CTA. Other 3 status flows (`confirmed`/`shipped`/`cancelled`) intentionally remain INTERNAL-OK on the wrapper. |
| 6 | `sendOrderStatusEmail (cancelled)` | 417 | `buildOrderCancelledHtml` (386) | INTERNAL-OK | Cancellation should not push CTAs. |
| 7 | `sendShippingNotificationEmail` | 598 | `buildShippingNotificationHtml` (526) | **BRAND-PASSED** | Uses `renderShopLink` (580) + `renderAboutValues` (584). |
| 8 | `sendAdminNewOrderEmail` | 789 | `buildAdminNewOrderHtml` (734) | INTERNAL-OK | Admin notification — `showTagline:false`, no public-facing polish. |
| 9 | `sendAdminDeadlineAlertEmail` | 832 | inline `content` (872) → `renderLayout` (896) | INTERNAL-OK | Admin alert — uses `renderLayout` + tokens, no polish needed. |
| 10 | `sendEmailChangeVerifyEmail` | 921 | inline `content` (933) → `renderLayout` (953) | INTERNAL-OK | Security email; polish would weaken urgency. |
| 11 | `sendEmailChangeNoticeEmail` | 975 | inline `content` (984) → `renderLayout` (1000) | INTERNAL-OK | Security notice. |
| 12 | `sendPasswordResetEmail` | 1067 | `buildPasswordResetHtml` (1026) → `renderLayout` (1056) | INTERNAL-OK | Security email. |
| 13 | `sendAccountDeletedEmail` | 1087 | inline `content` (1094) → `renderLayout` (1106) | INTERNAL-OK | GDPR exit; CTAs inappropriate. |
| 14 | `sendNewsletterWelcomeEmail` | 1124 | `buildNewsletterWelcomeHtml` (624) → `renderLayout` (673) | **BRAND-PASSED** _(C4924)_ | **CONVERTED in C4924 #572**: appended `renderAboutValues()` after the support-line below the primary CTA. No product data wired so `renderProductGrid` intentionally deferred; `renderShopLink` would duplicate the existing "Prohlédnout novinky" button so omitted. |
| 15 | `sendAccountWelcomeEmail` | 1231 | `buildAccountWelcomeHtml` (1158) → `renderLayout` (1220) | **BRAND-PASSED** | Uses `renderShopLink` (1217) + `renderAboutValues` (1218). |
| 16 | `sendAbandonedCartEmail` | 1463 | `buildAbandonedCartEmail{1,2,3}Html` → `buildAbandonedCartEmailWrapper` (1292) → `renderLayout` (1309) | **BRAND-PASSED** | Uses `renderShopLink` (1307, conditional) + `renderAboutValues` (1308) + `renderProductRowList`. |
| 17 | `sendReviewRequestEmail` | 1605 | `buildReviewRequestHtml` (1526) → `renderLayout` (1594) | **BRAND-PASSED** _(C4923)_ | **CONVERTED in C4923 #571**: trailing inline "nebo se podívej na novinky →" link replaced by `renderShopLink("Nebo projít celou nabídku")`, with `renderAboutValues()` appended below. The "Kdyby něco nesedělo, napiš mi rovnou." support note kept as a standalone line so support and brand-pillar polish are visually distinct. |
| 18 | `sendDeliveryCheckEmail` | 1692 | `buildDeliveryCheckHtml` (1639) → `renderLayout` (1679) | **BRAND-PASSED** _(C4924)_ | **CONVERTED in C4924 #572**: appended `renderShopLink("Nebo se podívat na nové kousky")` + `renderAboutValues()` after the order-detail link below the primary "Mám problém" CTA. Returns CTA stays primary; brand polish lives below it so the support focus is preserved. |
| 19 | `sendNewArrivalEmail` | 1792 | `buildNewArrivalHtml` (1754) → `renderLayout` (1778) | **BRAND-PASSED** _(this cycle)_ | **CONVERTED in this cycle**: added `renderShopLink("Nebo projít celou nabídku")` + `renderAboutValues()` after the product grid. Already uses `renderProductGrid`. |
| 20 | `sendBrowseAbandonmentEmail` | 1884 | `buildBrowseAbandonmentHtml` (1833) → `renderLayout` (1871) | **BRAND-PASSED** _(C4925)_ | **CONVERTED in C4925 #574**: replaced trailing inline "Nebo se podívej na další kousky →" anchor with canonical `renderShopLink("Nebo se podívej na další kousky")` and appended `renderAboutValues()` below the primary "Vrátit se ke kousku" CTA. Unused `shopUrl` local removed. |
| 21 | `sendCrossSellFollowUpEmail` | 1971 | `buildCrossSellFollowUpHtml` (1941) → `renderLayout` (1958) | **BRAND-PASSED** _(C4925)_ | **CONVERTED in C4925 #574**: appended `renderAboutValues()` after the existing `renderProductGrid` + outline "Prohlédnout všechny novinky" CTA. CTA itself is the shop-browse, so no `renderShopLink` needed (matches `ctaIsShopBrowse` convention used in `abandoned-cart` 1322). |
| 22 | `sendWinBackEmail` | 2036 | `buildWinBackHtml` (2004) → `renderLayout` (2023) | PARTIAL | No products; could host `renderAboutValues` to re-anchor lapsed customers. **Recommend follow-up.** |
| 23 | `sendCampaignEmail` | 2141 | `buildCampaignHtml` (2108) → `renderLayout` (2129) | PARTIAL | Generic campaign wrapper — has `renderProductGrid`, lacks values footer. **Recommend follow-up.** |
| 24 | `renderCampaignEmailPreview` | 2166 | inline → `renderLayout` (2208) | PARTIAL | Preview-time analogue of campaign builder; same gap. |
| 25 | `renderMothersDayPreview` / `sendMothersDayEmail` (×3 builders) | 2369 / 2385 | `buildMothersDayEmail{1,2,3}Html` (2219, 2278, 2320) → `buildMothersDayEmailShell` (2202) → `renderLayout` (2208 in shell) | PARTIAL | Campaign shell renders custom `footerNote` (italic tagline) instead of `renderAboutValues`. Intentional — campaign tone — but inconsistency worth noting. |
| 26 | `renderCustomsCampaignPreview` / `sendCustomsCampaignEmail` (×2 builders) | 2548 / 2563 | `buildCustomsEmail{1,2}Html` (2445, 2496) → `buildCustomsEmailShell` (2428) → `renderLayout` (2434) | PARTIAL | Same shell pattern as Mother's Day — custom footer note replaces `renderAboutValues`. |
| 27 | `renderEmailPreview` (dispatcher) | 2744 | dispatches to all builders above | n/a | Registry only; preview path inherits each template's status. The `email-change-verify` case (2829) duplicates inline HTML rather than re-importing the sender's content; harmless but a dedup opportunity. |

## Tally

- **BRAND-PASSED**: 11 templates (order confirmation, shipping notification, account welcome, abandoned cart, new-arrival _(C4922)_, order-delivered _(C4923)_, review-request _(C4923)_, newsletter-welcome _(C4924)_, delivery-check _(C4924)_, **browse-abandonment** _(C4925)_, **cross-sell-follow-up** _(C4925)_).
- **PARTIAL** (renderLayout + tokens but missing pillar polish): 5 customer-facing templates — win-back, campaign, mother's-day shell, customs shell, campaign-preview.
- **INLINE-LEGACY**: **0 templates**. Every send-path goes through `renderLayout`. The audit confirms the brand-pass infrastructure rollout is structurally complete.
- **INTERNAL-OK** (admin/security — polish intentionally absent): 8 templates.

## Polish landed this cycle

**`buildNewArrivalHtml`** (line 1754, `src/lib/email.ts`) — added `renderShopLink("Nebo projít celou nabídku")` and `renderAboutValues()` after the existing `renderProductGrid` + outline button. New-arrival is a high-volume retention channel; the pillars footer ("Vybírám osobně / Jeden kus, jedna šance / Česká a blízká") differentiates against Vinted and Zalando Pre-Owned, which is the explicit Q2 positioning per project memory `project_zalando_preowned_cz_live.md`.

Diff is one block; no signature change, no call-site change, no new imports (`renderShopLink` and `renderAboutValues` were already imported on lines 25–26).

## Recommended follow-up bundles

Group the remaining 7 PARTIAL templates into two cohesive Sage tasks (1–2 per cycle pace per #571):

1. **POLISH-RETENTION** — _Done C4925 #574_: `browse-abandonment` + `cross-sell-follow-up` both converted; `renderAboutValues()` appended and `renderShopLink` swapped in for the legacy inline anchor on browse-abandonment.
2. **POLISH-CAMPAIGN** (3 templates + 2 shells): `win-back`, `campaign`, `campaign-preview`, `mother's-day shell`, `customs shell` — replace the bespoke campaign footer notes with `renderAboutValues()` and add `renderShopLink` where missing. Watch for tone clash on customs/Mother's Day, where the bespoke italic footer is part of the creative; may prefer a hybrid (values + tagline). _(`newsletter-welcome` landed in C4924 #572.)_

## Acceptance checklist

- [x] Audit doc emitted at `docs/audits/email-brand-pass-2026-04-25.md`.
- [x] Table covers every `send*` / `build*` / `render*Preview` export — 27 rows.
- [x] One PARTIAL template converted to BRAND-PASSED in same cycle commit (`buildNewArrivalHtml`; +`buildOrderDeliveredHtml` & `buildReviewRequestHtml` in C4923 #571; +`buildNewsletterWelcomeHtml` & `buildDeliveryCheckHtml` in C4924 #572).
- [x] No edits to `addresses.ts`, `smtp-transport.ts`, or `layout.ts`.
- [x] Commit message will name the converted template.
