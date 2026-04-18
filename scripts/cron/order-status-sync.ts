/**
 * Hetzner cron: poll Packeta for in-transit orders and persist status.
 *
 * Selects orders with a packetId that are still en-route (status in
 * paid|shipped|in_transit|delivered with no packetaStatusCheckedAt within
 * the last 45 minutes), calls Packeta SOAP `packetStatus`, and writes
 * `Order.packetaStatus` + `Order.packetaStatusCheckedAt`.
 *
 * Designed to run hourly via /etc/cron.d/janicka-shop. Wrapped in flock at
 * the cron level to prevent overlap if a prior run hangs on Packeta SOAP.
 *
 * Usage:
 *   tsx scripts/cron/order-status-sync.ts          # live
 *   tsx scripts/cron/order-status-sync.ts --dry    # print intended polls, no API call, no DB write
 *
 * Env required:
 *   DATABASE_URL                 (Prisma)
 *   PACKETA_API_PASSWORD         (Packeta SOAP)
 *   TURSO_DATABASE_URL + TURSO_AUTH_TOKEN  (production via libsql adapter)
 */

import { getDb } from "../../src/lib/db";
import { getPacketStatus } from "../../src/lib/shipping/packeta";

const DRY = process.argv.includes("--dry");
const STALE_MINUTES = 45; // re-poll any packet not checked in last 45m
const BATCH = 100; // soft cap per run — Packeta SOAP is slow, ~1s per packet
const TERMINAL_STATUSES = new Set([
  "delivered",
  "delivered to consignee",
  "returned",
  "returned to sender",
  "cancelled",
]);

interface OrderRow {
  id: string;
  orderNumber: string;
  packetId: string | null;
  packetaStatus: string | null;
}

async function main(): Promise<void> {
  if (!DRY && !process.env.PACKETA_API_PASSWORD) {
    console.error("[order-status-sync] PACKETA_API_PASSWORD missing — refusing to run");
    process.exit(2);
  }

  const db = await getDb();
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);

  // Active = handed to courier but not yet in a terminal state we have stored.
  // Status filter intentionally broad: status="paid" can already have a packetId
  // if admin pre-created the label, and "delivered" can flip to "returning".
  const orders = (await db.order.findMany({
    where: {
      packetId: { not: null },
      status: { in: ["paid", "shipped", "in_transit", "delivered"] },
      OR: [
        { packetaStatusCheckedAt: null },
        { packetaStatusCheckedAt: { lt: cutoff } },
      ],
    },
    select: { id: true, orderNumber: true, packetId: true, packetaStatus: true },
    take: BATCH,
    orderBy: { updatedAt: "desc" },
  })) as OrderRow[];

  if (orders.length === 0) {
    console.log("[order-status-sync] no eligible orders");
    return;
  }

  if (DRY) {
    console.log(`[order-status-sync] DRY — would poll ${orders.length} packet(s):`);
    for (const o of orders) {
      console.log(`  ${o.orderNumber} packet=${o.packetId} prior=${o.packetaStatus ?? "—"}`);
    }
    return;
  }

  let updated = 0;
  let unchanged = 0;
  let errored = 0;
  const now = new Date();

  for (const o of orders) {
    if (!o.packetId) continue;
    try {
      const result = await getPacketStatus(o.packetId);
      const code = result.codeText;
      const changed = code !== o.packetaStatus;

      await db.order.update({
        where: { id: o.id },
        data: {
          packetaStatus: code,
          packetaStatusCheckedAt: now,
        },
      });

      if (changed) {
        updated++;
        console.log(
          `[order-status-sync] ${o.orderNumber} ${o.packetaStatus ?? "—"} → ${code}` +
            (TERMINAL_STATUSES.has(code.toLowerCase()) ? " [terminal]" : "")
        );
      } else {
        unchanged++;
      }
    } catch (err) {
      errored++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[order-status-sync] ${o.orderNumber} packet=${o.packetId} failed: ${msg}`);
    }
  }

  console.log(
    `[order-status-sync] polled=${orders.length} updated=${updated} unchanged=${unchanged} errored=${errored}`
  );
}

main()
  .catch((err) => {
    console.error("[order-status-sync] crashed:", err);
    process.exit(1);
  })
  .finally(() => {
    // Force exit — Prisma keeps libsql client alive otherwise
    setTimeout(() => process.exit(0), 100).unref();
  });
