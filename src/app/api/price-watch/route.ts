import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { logger } from "@/lib/logger";

const bodySchema = z.object({
  productId: z.string().min(1).max(128),
  email: z.string().email().max(254).optional(),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  // Resolve email + userId — session takes priority for one-click flow.
  const session = await auth();
  const sessionEmail =
    session?.user?.role === "customer" ? session.user.email ?? null : null;
  const email = (sessionEmail ?? parsed.data.email ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 });
  }
  const userId = session?.user?.role === "customer" ? session.user.id ?? null : null;

  const ip = await getClientIp();
  const rl = checkRateLimit(`price-watch:${ip}`, 5, 60_000);
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  try {
    const db = await getDb();
    const product = await db.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true, price: true, active: true, sold: true },
    });
    if (!product || !product.active || product.sold) {
      return NextResponse.json({ ok: false, error: "product_unavailable" }, { status: 404 });
    }

    // Email-token bound to email at opt-in; HMAC ensures we can verify on
    // unsubscribe without exposing the email in the URL.
    const unsubToken = `${signUnsubscribeToken(email)}.${randomBytes(8).toString("hex")}`;

    await db.priceWatch.upsert({
      where: { email_productId: { email, productId: product.id } },
      create: {
        email,
        productId: product.id,
        currentPrice: product.price,
        userId,
        unsubToken,
      },
      update: {
        // Re-arm watcher to current price if user re-subscribes (e.g. after admin
        // bumped price up); preserve the original unsubToken to keep email links valid.
        currentPrice: product.price,
        userId: userId ?? undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[PriceWatch] POST failed:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
