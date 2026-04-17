import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { buildCustomerDataBundle } from "@/lib/gdpr-export";
import { logEvent } from "@/lib/audit-log";

/**
 * GDPR Article 20 — data portability.
 *
 * Returns the authenticated customer's full personal-data bundle as JSON.
 * Rate-limited to 1 export per 24h per customer (persisted on Customer.lastDataExportAt
 * so the limit survives serverless cold-starts).
 */
export async function POST(): Promise<Response> {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: session.user.id },
    select: { id: true, deletedAt: true, lastDataExportAt: true },
  });
  if (!customer || customer.deletedAt) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // 1-per-24h gate.
  const now = Date.now();
  if (
    customer.lastDataExportAt &&
    now - customer.lastDataExportAt.getTime() < 24 * 60 * 60 * 1000
  ) {
    const retryAfter = Math.ceil(
      (customer.lastDataExportAt.getTime() + 24 * 60 * 60 * 1000 - now) / 1000,
    );
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: "Export je možný jednou za 24 hodin. Zkus to zítra.",
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const bundle = await buildCustomerDataBundle(customer.id);

  await db.customer.update({
    where: { id: customer.id },
    data: { lastDataExportAt: new Date() },
  });
  await logEvent({ customerId: customer.id, action: "gdpr_export" });

  const datestamp = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify(bundle, null, 2);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="janicka-data-${datestamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

/** GET is allowed as a browser-friendly alternative (the Stáhnout button uses a plain link). */
export async function GET(): Promise<Response> {
  return POST();
}
