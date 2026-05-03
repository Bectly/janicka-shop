import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * GET /api/price-watch/unsubscribe?token=...
 *
 * Single-use unsubscribe link from price-drop emails. The token is unique
 * per PriceWatch row (signed email + random suffix) so we can match a single
 * row without trusting the URL to carry the email or product id in cleartext.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token || token.length > 512) {
    return new NextResponse(buildHtml(false), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    const db = await getDb();
    const row = await db.priceWatch.findUnique({
      where: { unsubToken: token },
      select: { id: true },
    });
    if (!row) {
      // Already removed or never existed — show success anyway (idempotent).
      return new NextResponse(buildHtml(true), {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    await db.priceWatch.delete({ where: { id: row.id } });
    return new NextResponse(buildHtml(true), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    logger.error("[PriceWatch] Unsubscribe failed:", err);
    return new NextResponse(buildHtml(false), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

function buildHtml(success: boolean): string {
  const title = success ? "Hlídání ceny zrušeno" : "Něco se nepovedlo";
  const message = success
    ? "Už ti nebudeme posílat upozornění na pokles ceny tohoto kousku."
    : "Odhlášení se nepodařilo. Zkus to prosím znovu.";
  const icon = success ? "✓" : "✕";
  const iconBg = success ? "#d1fae5" : "#fee2e2";
  const iconColor = success ? "#065f46" : "#991b1b";

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title} | Janička Shop</title>
  <style>
    body { margin: 0; padding: 0; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; }
    .wrap { max-width: 480px; margin: 80px auto; padding: 24px; text-align: center; }
    .icon { width: 64px; height: 64px; border-radius: 50%; background: ${iconBg}; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 28px; color: ${iconColor}; }
    h1 { margin: 0 0 12px; font-size: 22px; color: #1a1a1a; }
    p { margin: 0 0 28px; color: #666; font-size: 15px; line-height: 1.6; }
    a { display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/">Zpět do obchodu</a>
  </div>
</body>
</html>`;
}
