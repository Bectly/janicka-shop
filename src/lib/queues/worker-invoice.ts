import type { Job } from "bullmq";
import type { InvoiceJobData } from "./index";

/**
 * Invoice worker processor.
 *
 * P4.1 scaffold: processes smoke-test jobs ({ orderId: "__smoke" }) so the
 * worker can be verified `active` end-to-end. Real invoice generation for
 * order IDs is wired in P4.2 when admin Server Actions are refactored to
 * enqueue. The extraction of the InvoiceData mapping out of
 * src/app/(admin)/admin/orders/actions.ts into a shared helper belongs to
 * that task.
 */
export async function processInvoiceJob(
  job: Job<InvoiceJobData>,
): Promise<{ ok: true; orderId: string }> {
  const { orderId, emailAfter } = job.data;

  if (orderId === "__smoke") {
    await job.log("smoke invoice job — ok");
    return { ok: true, orderId };
  }

  throw new Error(
    `Invoice worker not yet wired for real orders (orderId=${orderId}, emailAfter=${emailAfter}) — see task P4.2.`,
  );
}
