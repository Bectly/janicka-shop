---
name: Comgate payment integration status
description: Comgate inline payment flow implementation status and architecture
type: project
---

Comgate inline payment integration built in Cycle #2350.

**Architecture:**
- `src/lib/payments/comgate.ts` — REST client (was already complete: createComgatePayment, getComgatePaymentStatus, refundComgatePayment)
- `src/lib/payments/comgate-sdk.ts` — SDK wrapper for Apple Pay / Google Pay (was already committed in prior cycle)
- `src/lib/payments/types.ts` — shared types
- `src/app/api/payments/comgate/route.ts` — webhook handler (was already complete)
- `src/app/api/payments/comgate/create/route.ts` — NEW: client-side payment creation for inline flow
- `src/components/shop/checkout/comgate-payment-section.tsx` — NEW: inline payment UI component
- `src/app/(shop)/checkout/payment-return/page.tsx` — payment return page (was already complete)

**Payment flow:**
- CARD: server action returns `{pendingPayment: {orderNumber, accessToken}}`, client renders ComgatePaymentSection, calls `/api/payments/comgate/create`, shows 504×679px inline iframe
- BANK TRANSFER: server action creates Comgate payment server-side, redirects to Comgate hosted page
- COD: server action redirects directly to order confirmation page

**What's needed to activate:**
- COMGATE_MERCHANT_ID (from Comgate portal)
- COMGATE_SECRET (from Comgate portal)
- COMGATE_TEST=true (set to "false" for production)
- NEXT_PUBLIC_COMGATE_CHECKOUT_ID (from Comgate portal → Checkout section, for Apple/Google Pay SDK)

**Why:** The shop had 364+ products but no payment capability. This was the highest priority missing feature.
