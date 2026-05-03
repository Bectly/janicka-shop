import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  productId: z.string().min(1).max(128),
  productSlug: z.string().min(1).max(300).optional(),
  productName: z.string().min(1).max(500).optional(),
  productImage: z.string().max(2000).optional(),
  productPrice: z.number().finite().nonnegative().optional(),
  productBrand: z.string().max(200).optional(),
  productSize: z.string().max(100).optional(),
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * POST /api/products/view — browse abandonment capture endpoint.
 *
 * REST counterpart to the trackBrowseView server action. Insert a
 * pending BrowseAbandonment row only if (a) caller doesn't already
 * have a pending row for this product and (b) caller hasn't received
 * a browse-abandonment email in the last 7 days (frequency cap).
 *
 * Product fields are looked up server-side when missing — clients
 * may send only { email, productId } and we hydrate from the DB.
 */
export async function POST(request: Request): Promise<Response> {
  const ip = await getClientIp();
  const rl = checkRateLimit(`product-view:${ip}`, 60, 60_000);
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

  const input = parsed.data;
  const email = input.email;

  try {
    const db = await getDb();

    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);
    const recentlySent = await db.browseAbandonment.findFirst({
      where: { email, status: "sent", sentAt: { gt: sevenDaysAgo } },
      select: { id: true },
    });
    if (recentlySent) {
      return NextResponse.json({ ok: true, tracked: false, reason: "frequency_cap" });
    }

    const existing = await db.browseAbandonment.findFirst({
      where: { email, productId: input.productId, status: "pending" },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, tracked: false, reason: "duplicate" });
    }

    let { productSlug, productName, productImage, productPrice, productBrand, productSize } = input;
    if (!productSlug || !productName || productPrice == null) {
      const product = await db.product.findUnique({
        where: { id: input.productId },
        select: {
          slug: true,
          name: true,
          price: true,
          brand: true,
          sizes: true,
          images: true,
          active: true,
          sold: true,
        },
      });
      if (!product || !product.active || product.sold) {
        return NextResponse.json({ ok: true, tracked: false, reason: "product_unavailable" });
      }

      let firstImage: string | undefined;
      try {
        const imgs = JSON.parse(product.images);
        if (Array.isArray(imgs) && typeof imgs[0] === "string") firstImage = imgs[0];
      } catch {
        // ignore malformed JSON — leave firstImage undefined
      }

      let firstSize: string | undefined;
      try {
        const szs = JSON.parse(product.sizes);
        if (Array.isArray(szs) && typeof szs[0] === "string") firstSize = szs[0];
      } catch {
        // ignore
      }

      productSlug = productSlug ?? product.slug;
      productName = productName ?? product.name;
      productImage = productImage ?? firstImage;
      productPrice = productPrice ?? product.price;
      productBrand = productBrand ?? product.brand ?? undefined;
      productSize = productSize ?? firstSize;
    }

    const created = await db.browseAbandonment.create({
      data: {
        email,
        productId: input.productId,
        productSlug: productSlug!,
        productName: productName!,
        productImage: productImage ?? null,
        productPrice: productPrice!,
        productBrand: productBrand ?? null,
        productSize: productSize ?? null,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, tracked: true, id: created.id });
  } catch (err) {
    logger.error("[ProductView] Failed:", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
