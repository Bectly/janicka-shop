import { NextRequest, NextResponse, connection } from "next/server";
import { getDb } from "@/lib/db";


/**
 * GET /api/orders/[orderNumber]/status?token=...
 *
 * Lightweight endpoint for client-side polling of payment status.
 * Returns only order status and payment method — no PII.
 * Token-authenticated to prevent enumeration.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  await connection();
  const { orderNumber } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!orderNumber || !token) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  const db = await getDb();
  const order = await db.order.findUnique({
    where: { orderNumber },
    select: {
      status: true,
      paymentMethod: true,
      accessToken: true,
    },
  });

  if (!order || order.accessToken !== token) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: order.status,
    paymentMethod: order.paymentMethod,
  });
}
