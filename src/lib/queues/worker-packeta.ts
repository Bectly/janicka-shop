import type { Job } from "bullmq";
import type { PacketaJobData } from "./index";

/**
 * Packeta worker processor.
 *
 * P4.1 scaffold: processes smoke-test jobs ({ orderId: "__smoke" }) so the
 * worker can be verified `active` end-to-end. Real packet creation for
 * order IDs is wired in P4.2 when admin Server Actions are refactored to
 * enqueue and a shared helper is extracted out of
 * src/app/(admin)/admin/orders/actions.ts.
 */
export async function processPacketaJob(
  job: Job<PacketaJobData>,
): Promise<{ ok: true; orderId: string }> {
  const { orderId, fetchLabel } = job.data;

  if (orderId === "__smoke") {
    await job.log("smoke packeta job — ok");
    return { ok: true, orderId };
  }

  throw new Error(
    `Packeta worker not yet wired for real orders (orderId=${orderId}, fetchLabel=${fetchLabel}) — see task P4.2.`,
  );
}
