import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { logEvent } from "@/lib/audit-log";
import { invalidateCustomerScope } from "@/lib/customer-cache";

const bodySchema = z.object({
  productIds: z.array(z.string().max(128)).max(200),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

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

  const ids = [...new Set(parsed.data.productIds)];
  const db = await getDb();
  const customerId = session.user.id;

  let merged = 0;
  if (ids.length > 0) {
    // Only keep product IDs that exist and are active. Filter silently.
    const valid = (
      await db.product.findMany({
        where: { id: { in: ids }, active: true },
        select: { id: true },
      })
    ).map((p) => p.id);

    // Parallel upserts — each row is independent and the unique index dedupes.
    const results = await Promise.all(
      valid.map((productId) =>
        db.customerWishlist
          .upsert({
            where: { customerId_productId: { customerId, productId } },
            create: { customerId, productId },
            update: {},
          })
          .then(() => true)
          .catch(() => false),
      ),
    );
    merged = results.filter(Boolean).length;

    if (merged > 0) {
      await logEvent({
        customerId,
        action: "wishlist_add",
        metadata: { merged, source: "localStorage_sync" },
      });
      invalidateCustomerScope(customerId, "wishlist");
    }
  }

  // Return full DB wishlist so the caller can mirror it into Zustand atomically.
  const all = (
    await db.customerWishlist.findMany({
      where: { customerId },
      select: { productId: true },
    })
  ).map((r) => r.productId);

  return NextResponse.json({ ok: true, merged, all });
}
