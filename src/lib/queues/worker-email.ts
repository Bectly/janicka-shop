import type { Job } from "bullmq";
import type { EmailJobData, EmailJobType } from "./index";
import {
  sendOrderConfirmationEmail,
  sendPaymentConfirmedEmail,
  sendShippingNotificationEmail,
  sendReviewRequestEmail,
  sendDeliveryCheckEmail,
  sendNewArrivalEmail,
  sendAdminNewOrderEmail,
  sendEmailChangeVerifyEmail,
  sendEmailChangeNoticeEmail,
  sendAccountDeletedEmail,
  sendNewsletterWelcomeEmail,
} from "@/lib/email";

/**
 * Email worker processor. Dispatches to the matching Resend sender based on
 * job.type. Payload is passed through as the single argument — this assumes
 * the caller enqueues with the exact shape the sender expects.
 *
 * Not-yet-wired job types throw — caller should fall back to inline send
 * until the worker supports them. Extend this switch when moving a sender
 * from inline-await to queued.
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { type, payload } = job.data;
  const p = payload as never;

  switch (type) {
    case "order-confirmation":
      await sendOrderConfirmationEmail(p);
      return;
    case "payment-confirmed":
      await sendPaymentConfirmedEmail(p);
      return;
    case "shipping-notification":
      await sendShippingNotificationEmail(p);
      return;
    case "review-request":
      await sendReviewRequestEmail(p);
      return;
    case "delivery-check":
      await sendDeliveryCheckEmail(p);
      return;
    case "new-arrival":
      await sendNewArrivalEmail(p);
      return;
    case "admin-new-order":
      await sendAdminNewOrderEmail(p);
      return;
    case "email-change-verify":
      await sendEmailChangeVerifyEmail(p);
      return;
    case "email-change-notice":
      await sendEmailChangeNoticeEmail(p);
      return;
    case "account-deleted":
      await sendAccountDeletedEmail(p);
      return;
    case "newsletter-welcome":
      await sendNewsletterWelcomeEmail((payload as { email: string }).email);
      return;
    default:
      throw new Error(`Email job type not wired in worker: ${type satisfies EmailJobType}`);
  }
}
