import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getOrCreateVisitorId } from "@/lib/visitor";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  cartItems: z
    .array(
      z.object({
        productId: z.string().min(1).max(128),
        name: z.string().min(1).max(300),
        price: z.number().finite().nonnegative(),
        size: z.string().max(50).optional(),
        color: z.string().max(50).optional(),
        image: z.string().max(2000).optional(),
        slug: z.string().max(300).optional(),
      }),
    )
    .min(1)
    .max(50),
  cartTotal: z.number().finite().nonnegative(),
  marketingConsent: z.boolean(),
  pageUrl: z.string().max(500).optional(),
});

/**
 * POST /api/cart/capture — abandoned cart email capture endpoint.
 *
 * Mirrors the captureCartEmail server action so non-React clients
 * (sendBeacon on unload, external webhooks, manager tools) can drop a
 * pending AbandonedCart row that the cron pipeline will pick up.
 *
 * Dedup: one pending row per email is updated in place.
 * Returns 200 with { ok:true } on success; on validation/rate-limit
 * failure returns the appropriate 4xx but never leaks db errors.
 */
export async function POST(request: Request): Promise<Response> {
  const ip = await getClientIp();
  const rl = checkRateLimit(`cart-capture:${ip}`, 30, 60_000);
  if (!rl.success) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const { email, cartItems, cartTotal, marketingConsent, pageUrl } = parsed.data;

  try {
    const db = await getDb();
    const visitorId = await getOrCreateVisitorId();

    const existing = await db.abandonedCart.findFirst({
      where: { email, status: "pending" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const data = {
      cartItems: JSON.stringify(cartItems),
      cartTotal,
      visitorId,
      pageUrl: pageUrl ?? "/cart",
      marketingConsent,
    };

    if (existing) {
      await db.abandonedCart.update({ where: { id: existing.id }, data });
      return NextResponse.json({ ok: true, id: existing.id, updated: true });
    }

    const created = await db.abandonedCart.create({
      data: { email, ...data },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: created.id, updated: false });
  } catch (err) {
    logger.error("[CartCapture] Failed:", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
