/**
 * Enqueue a smoke-test job on each queue. For verifying workers are running.
 *
 * Usage:
 *   REDIS_URL=redis://... npx tsx scripts/workers/enqueue-smoke.ts [email|invoice|packeta|all]
 */

import { enqueueInvoice, enqueuePacketaLabel, emailQueue } from "../../src/lib/queues";

async function main(): Promise<void> {
  const target = process.argv[2] ?? "all";

  if (target === "email" || target === "all") {
    await emailQueue().add("smoke", {
      type: "newsletter-welcome",
      payload: { email: "smoke@janicka-shop.local" },
    });
    console.info("enqueued email smoke job");
  }

  if (target === "invoice" || target === "all") {
    await enqueueInvoice({ orderId: "__smoke", emailAfter: false });
    console.info("enqueued invoice smoke job");
  }

  if (target === "packeta" || target === "all") {
    await enqueuePacketaLabel({ orderId: "__smoke", fetchLabel: false });
    console.info("enqueued packeta smoke job");
  }

  // Queues hold their own IORedis connection; give them time to flush, then exit.
  setTimeout(() => process.exit(0), 500);
}

main().catch((err) => {
  console.error("enqueue-smoke failed:", err);
  process.exit(1);
});
