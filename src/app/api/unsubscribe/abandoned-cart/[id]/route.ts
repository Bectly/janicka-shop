import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * GDPR-compliant unsubscribe endpoint for abandoned cart recovery emails.
 * Marks the AbandonedCart record as expired so no further emails are sent.
 *
 * The cart `id` (cuid) acts as the unsubscribe token — it is non-guessable
 * and is embedded in every abandoned cart email footer.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  if (!id || typeof id !== "string" || id.length > 64) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  try {
    const db = await getDb();

    // Find the cart — accept any status so double-unsubscribe is harmless
    const cart = await db.abandonedCart.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!cart) {
      // Return success page even when not found — avoids information leakage
      // about which cart IDs exist in the database.
      return buildUnsubscribePage(true);
    }

    // Only update if not already expired/recovered — idempotent
    if (cart.status === "pending") {
      await db.abandonedCart.update({
        where: { id },
        data: { status: "expired" },
      });
    }

    return buildUnsubscribePage(true);
  } catch (error) {
    console.error("[Unsubscribe] Failed to process unsubscribe:", error);
    return buildUnsubscribePage(false);
  }
}

function buildUnsubscribePage(success: boolean): Response {
  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${success ? "Odhlásit se — Janička Shop" : "Chyba — Janička Shop"}</title>
  <style>
    body { margin: 0; padding: 0; background: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; }
    .container { max-width: 480px; margin: 80px auto; padding: 0 24px; text-align: center; }
    h1 { font-size: 24px; color: #1a1a1a; margin-bottom: 12px; }
    p { font-size: 15px; color: #666; line-height: 1.6; }
    a { display: inline-block; margin-top: 24px; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    ${success
      ? `<h1>Odhlášení proběhlo úspěšně</h1>
         <p>Nebudeme tě už upozorňovat na opuštěný košík. Pokud se rozhodneš nakoupit, vždy tě rádi uvítáme.</p>
         <a href="/">Zpět na Janička Shop</a>`
      : `<h1>Něco se nepovedlo</h1>
         <p>Zkuste to prosím znovu nebo nás kontaktujte.</p>
         <a href="/">Zpět na Janička Shop</a>`
    }
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
