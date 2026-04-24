/**
 * Fires real email templates from src/lib/email.ts through the production
 * SMTP transport (Resend SMTP). Hard-coded TO = jkopecky666@gmail.com.
 */

import {
  sendOrderConfirmationEmail,
  sendPaymentConfirmedEmail,
  sendShippingNotificationEmail,
  sendEmailChangeVerifyEmail,
  sendNewsletterWelcomeEmail,
  sendAbandonedCartEmail,
} from "../src/lib/email";

const TO = "jkopecky666@gmail.com";

const items = [
  { name: "Žluté maxi šaty Shein", price: 249, size: "M", color: "žlutá" },
  { name: "Pánská zimní bunda CXS", price: 299, size: "L", color: "černá" },
  { name: "NA-KD maxi šaty růžové", price: 229, size: "XS", color: "růžová" },
];

const demoImage = "https://pub-88d95c0ca85d4cb999122434d83fb3c9.r2.dev/demo.jpg";

async function run() {
  console.log("→ sendOrderConfirmationEmail");
  await sendOrderConfirmationEmail({
    orderNumber: "JN-260424-SMOKE",
    customerName: "Jan Kopecký",
    customerEmail: TO,
    items,
    subtotal: 777,
    shipping: 69,
    total: 846,
    paymentMethod: "card",
    shippingMethod: "Zásilkovna — výdejní místo",
    shippingName: "Jan Kopecký",
    shippingStreet: "Sousedská 2",
    shippingCity: "Plzeň",
    shippingZip: "30100",
    shippingPointId: null,
    note: null,
    accessToken: "demo-access-token",
    isCod: false,
    expectedDeliveryDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
  });

  console.log("→ sendPaymentConfirmedEmail");
  await sendPaymentConfirmedEmail({
    orderNumber: "JN-260424-SMOKE",
    customerName: "Jan Kopecký",
    customerEmail: TO,
    total: 846,
    accessToken: "demo-access-token",
  } as any);

  console.log("→ sendShippingNotificationEmail");
  await sendShippingNotificationEmail({
    orderNumber: "JN-260424-SMOKE",
    customerName: "Jan Kopecký",
    customerEmail: TO,
    total: 846,
    accessToken: "demo-access-token",
    trackingNumber: "Z1234567890",
    items,
    crossSellProducts: [],
  });

  console.log("→ sendEmailChangeVerifyEmail");
  await sendEmailChangeVerifyEmail({
    newEmail: TO,
    firstName: "Jan",
    verifyUrl: "https://jvsatnik.cz/account/change-email/confirm?token=demo",
  });

  console.log("→ sendNewsletterWelcomeEmail");
  await sendNewsletterWelcomeEmail(TO);

  console.log("→ sendAbandonedCartEmail (stage 1)");
  await sendAbandonedCartEmail(1, {
    email: TO,
    customerName: "Jan Kopecký",
    items: [
      { productId: "p1", name: "Žluté maxi šaty Shein", price: 249, image: demoImage, slug: "zlute-maxi-saty-shein", size: "M", color: "žlutá" },
      { productId: "p2", name: "NA-KD maxi šaty růžové", price: 229, image: demoImage, slug: "na-kd-maxi-saty-ruzove", size: "XS", color: "růžová" },
    ],
    cartTotal: 478,
    cartId: "demo-cart-id-xyz",
  });

  console.log("\n✓ 6 templates fired. Check jkopecky666@gmail.com.");
}

run().catch((err) => {
  console.error("✗ smoke failed:", err);
  process.exit(1);
});
