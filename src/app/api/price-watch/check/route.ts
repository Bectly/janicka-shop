import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * GET /api/price-watch/check?productId=...&email=...
 *
 * Lightweight membership check used by the PDP "Sledovat cenu" button so the
 * label can switch to "Hlídáš cenu" without server-rendering the state. Email
 * is taken from the session for signed-in customers; unauthenticated callers
 * may pass it as a query param (no enumeration risk — only returns boolean).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("productId");
  if (!productId || productId.length > 128) {
    return NextResponse.json({ watched: false });
  }

  const session = await auth();
  const sessionEmail =
    session?.user?.role === "customer" ? session.user.email ?? null : null;
  const queryEmail = searchParams.get("email");
  const email = (sessionEmail ?? queryEmail ?? "").trim().toLowerCase();
  if (!email || email.length > 254) {
    return NextResponse.json({ watched: false });
  }

  try {
    const db = await getDb();
    const row = await db.priceWatch.findUnique({
      where: { email_productId: { email, productId } },
      select: { id: true },
    });
    return NextResponse.json({ watched: !!row });
  } catch {
    return NextResponse.json({ watched: false });
  }
}
