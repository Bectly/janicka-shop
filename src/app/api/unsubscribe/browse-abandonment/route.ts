import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

/**
 * GET /api/unsubscribe/browse-abandonment?token=...
 *
 * Opt-out from browse abandonment emails.
 * Token is HMAC-signed (UNSUBSCRIBE_HMAC_SECRET) to prevent enumeration.
 * Marks all pending BrowseAbandonment records for this email as "sent"
 * (with sentAt = now), which activates the 7-day frequency cap and
 * prevents both the cron and trackBrowseView from sending further emails.
 *
 * Why "sent" status: the cron and trackBrowseView both check for
 * status="sent" + sentAt within the last 7 days to enforce the frequency
 * cap. Setting sentAt=now effectively suppresses emails for 7 days — the
 * same window the system already uses. A permanent opt-out list would
 * require a separate table and schema change; this is the minimal safe fix.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const email = token ? verifyUnsubscribeToken(token) : null;

  if (!email) {
    return new NextResponse(buildHtml(false), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const normalizedEmail = email.toLowerCase();

  try {
    const db = await getDb();

    // Mark all pending records as "sent" with sentAt=now to activate
    // the 7-day frequency cap and prevent future emails this week.
    await db.browseAbandonment.updateMany({
      where: {
        email: normalizedEmail,
        status: "pending",
      },
      data: {
        status: "sent",
        sentAt: new Date(),
      },
    });

    return new NextResponse(buildHtml(true), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("[Unsubscribe] Browse abandonment opt-out failed for", normalizedEmail, error);
    return new NextResponse(buildHtml(false), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

function buildHtml(success: boolean): string {
  const title = success ? "Odhlášení proběhlo úspěšně" : "Něco se nepovedlo";
  const message = success
    ? "Nebudeme tě upozorňovat na prohlížené kousky. Přejeme hezký nákup!"
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
