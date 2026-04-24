import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES, getRedisUrl, type QueueName } from "./connection";
import { logger } from "@/lib/logger";

/**
 * BullMQ queue registry.
 *
 * Queues:
 *   email    — Resend sends (order confirmation, shipping, abandoned cart, etc.)
 *   invoice  — PDF generation; downstream enqueues an email job with the PDF attached.
 *   packeta  — SOAP createPacket + label fetch.
 *
 * Job payloads are serialized to JSON by BullMQ — keep them plain and small
 * (ids, not full ORM objects). Workers re-fetch from DB as needed.
 */

// ── Job type registry ──

export type EmailJobType =
  | "order-confirmation"
  | "payment-confirmed"
  | "shipping-notification"
  | "order-status"
  | "abandoned-cart"
  | "review-request"
  | "delivery-check"
  | "new-arrival"
  | "browse-abandonment"
  | "cross-sell-follow-up"
  | "win-back"
  | "admin-new-order"
  | "admin-deadline-alert"
  | "newsletter-welcome"
  | "email-change-verify"
  | "email-change-notice"
  | "account-deleted"
  | "similar-item"
  | "wishlist-sold"
  | "campaign";

export interface EmailJobData {
  type: EmailJobType;
  /** Arbitrary payload forwarded to the matching email function. */
  payload: Record<string, unknown>;
}

export interface InvoiceJobData {
  orderId: string;
  /** If true, after PDF is generated enqueue an email job with the invoice attached. */
  emailAfter: boolean;
}

export interface PacketaJobData {
  orderId: string;
  /** If true, after createPacket enqueue a label fetch; store PDF on Order. */
  fetchLabel: boolean;
}

// ── Queue singletons ──

const globalForQueues = globalThis as unknown as {
  janickaQueues: Partial<Record<QueueName, Queue>> | undefined;
};

function getQueue<T>(name: QueueName): Queue<T> {
  if (!globalForQueues.janickaQueues) globalForQueues.janickaQueues = {};
  const existing = globalForQueues.janickaQueues[name] as Queue<T> | undefined;
  if (existing) return existing;

  const connection = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const queue = new Queue<T>(name, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 24 * 3600, count: 1_000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });

  globalForQueues.janickaQueues[name] = queue as unknown as Queue;
  return queue;
}

export function emailQueue(): Queue<EmailJobData> {
  return getQueue<EmailJobData>(QUEUE_NAMES.email);
}

export function invoiceQueue(): Queue<InvoiceJobData> {
  return getQueue<InvoiceJobData>(QUEUE_NAMES.invoice);
}

export function packetaQueue(): Queue<PacketaJobData> {
  return getQueue<PacketaJobData>(QUEUE_NAMES.packeta);
}

// ── Enqueue helpers ──
//
// Each helper no-ops gracefully if REDIS_URL is missing (dev, local tests,
// preview deploys). Production systemd unit sets REDIS_URL and workers run
// jobs. Callers can still `await` the helper; return value indicates whether
// the job was enqueued.

export async function enqueueEmail(
  data: EmailJobData,
  opts?: JobsOptions,
): Promise<boolean> {
  if (!process.env.REDIS_URL) return false;
  try {
    await emailQueue().add(data.type, data, opts);
    return true;
  } catch (err) {
    logger.warn("[queues] enqueueEmail failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function enqueueInvoice(
  data: InvoiceJobData,
  opts?: JobsOptions,
): Promise<boolean> {
  if (!process.env.REDIS_URL) return false;
  try {
    await invoiceQueue().add("generate", data, opts);
    return true;
  } catch (err) {
    logger.warn("[queues] enqueueInvoice failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function enqueuePacketaLabel(
  data: PacketaJobData,
  opts?: JobsOptions,
): Promise<boolean> {
  if (!process.env.REDIS_URL) return false;
  try {
    await packetaQueue().add("create-and-label", data, opts);
    return true;
  } catch (err) {
    logger.warn("[queues] enqueuePacketaLabel failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export { QUEUE_NAMES };
