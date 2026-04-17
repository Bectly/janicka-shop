import { NextResponse, connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Admin polling endpoint for the in-browser new-order notifier.
 * Returns orders created strictly after the provided `ts` query param
 * (ISO timestamp). Used by <AdminOrderNotifier> on a 30s interval.
 */
export async function GET(request: Request) {
  await connection();
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tsParam = url.searchParams.get("ts");
  const now = new Date();

  // ts must be a valid ISO string within the last 7 days — anything else falls back
  // to "now" so the first call after login doesn't flood with historical orders.
  let sinceDate = now;
  if (tsParam) {
    const parsed = new Date(tsParam);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (!Number.isNaN(parsed.getTime()) && now.getTime() - parsed.getTime() < sevenDaysMs) {
      sinceDate = parsed;
    }
  }

  const db = await getDb();
  const orders = await db.order.findMany({
    where: { createdAt: { gt: sinceDate } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
      paymentMethod: true,
      createdAt: true,
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({
    ts: now.toISOString(),
    count: orders.length,
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      total: o.total,
      status: o.status,
      paymentMethod: o.paymentMethod,
      createdAt: o.createdAt.toISOString(),
      customerName: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
    })),
  });
}
