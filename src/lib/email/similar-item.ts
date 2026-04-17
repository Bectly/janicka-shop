import { Resend } from "resend";
import { getDb } from "@/lib/db";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";

let cachedResend: Resend | null | undefined;

function getResendClient(): Resend | null {
  if (cachedResend !== undefined) return cachedResend;
  const key = process.env.RESEND_API_KEY;
  cachedResend = key ? new Resend(key) : null;
  return cachedResend;
}

const NEWSLETTER_FROM_EMAIL =
  process.env.NEWSLETTER_EMAIL_FROM ?? "Janička Shop <novinky@janicka-shop.cz>";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPriceCzk(price: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

const CONDITION_LABELS: Record<string, string> = {
  new_with_tags: "Nov\u00e9 s visa\u010dkou",
  new_without_tags: "Nov\u00e9 bez visa\u010dky",
  excellent: "V\u00fdborn\u00fd stav",
  good: "Dobr\u00fd stav",
  visible_wear: "Viditeln\u00e9 opot\u0159eben\u00ed",
};

interface SoldProduct {
  id: string;
  name: string;
  brand: string | null;
  categoryId: string;
  sizes: string;
  images: string;
}

interface SimilarProduct {
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  brand: string | null;
  condition: string;
  images: string;
  sizes: string;
}

function buildSimilarItemHtml(
  soldProduct: SoldProduct,
  similarProducts: SimilarProduct[],
  recipientEmail: string,
): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  const soldName = `${soldProduct.brand ? `${escapeHtml(soldProduct.brand)} ` : ""}${escapeHtml(soldProduct.name)}`;

  const cards = similarProducts.map((p) => {
    const productUrl = `${baseUrl}/products/${p.slug}`;
    let firstImage: string | null = null;
    try {
      const imgs: string[] = JSON.parse(p.images);
      firstImage = imgs[0] ?? null;
    } catch {
      /* ignore */
    }

    const imageHtml = firstImage
      ? `<img src="${escapeHtml(firstImage)}" alt="${escapeHtml(p.name)}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px 8px 0 0; display: block;" />`
      : `<div style="width: 100%; height: 180px; background: #f5f5f5; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center;"><span style="font-size: 40px;">&#128087;</span></div>`;

    const discount =
      p.compareAt && p.compareAt > p.price
        ? Math.round(((p.compareAt - p.price) / p.compareAt) * 100)
        : null;

    const priceHtml = discount
      ? `<span style="text-decoration: line-through; color: #999; font-size: 11px;">${formatPriceCzk(p.compareAt!)}</span> <strong style="color: #dc2626; font-size: 14px;">${formatPriceCzk(p.price)}</strong>`
      : `<strong style="color: #1a1a1a; font-size: 14px;">${formatPriceCzk(p.price)}</strong>`;

    const conditionLabel = CONDITION_LABELS[p.condition] ?? p.condition;
    let sizesArr: string[] = [];
    try {
      sizesArr = JSON.parse(p.sizes);
    } catch {
      /* ignore */
    }
    const sizesText = sizesArr.length > 0 ? sizesArr.join(", ") : null;

    return `
      <td style="width: 50%; padding: 6px; vertical-align: top;">
        <a href="${productUrl}" style="text-decoration: none; display: block; border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden;">
          ${imageHtml}
          <div style="padding: 10px;">
            <p style="margin: 0; color: #1a1a1a; font-size: 13px; font-weight: 600; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</p>
            ${p.brand ? `<p style="margin: 2px 0 0; color: #888; font-size: 11px;">${escapeHtml(p.brand)}</p>` : ""}
            <p style="margin: 2px 0 0; color: #666; font-size: 11px;">${escapeHtml(conditionLabel)}${sizesText ? ` &middot; Vel.: ${escapeHtml(sizesText)}` : ""}</p>
            <p style="margin: 6px 0 0;">${priceHtml}</p>
          </div>
        </a>
      </td>`;
  });

  const rows: string[] = [];
  for (let i = 0; i < cards.length; i += 2) {
    const second =
      cards[i + 1] ?? '<td style="width: 50%; padding: 6px;"></td>';
    rows.push(`<tr>${cards[i]}${second}</tr>`);
  }

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="text-decoration: none;">
        <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Jani&ccaron;ka Shop</h1>
      </a>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

      <div style="text-align: center;">
        <div style="width: 64px; height: 64px; background: #fef3c7; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#128172;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">${soldName} je pry&ccaron;</h2>
        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
          Kousek, kter&yacute; t&ecaron; zajímal, u&zcaron; na&scaron;el novou majitelku.
          Ale m&aacute;me pro tebe podobn&eacute; kousky &mdash; ka&zcaron;d&yacute; je unik&aacute;t!
        </p>
      </div>

      <div style="margin-top: 28px;">
        <h3 style="margin: 0 0 12px; font-size: 16px; color: #1a1a1a; text-align: center;">Mohlo by se ti l&iacute;bit</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${rows.join("")}
        </table>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${baseUrl}/products?sort=newest" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Prohl&eacute;dnout v&scaron;echny novinky
        </a>
      </div>

    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Jani&ccaron;ka Shop &mdash; Second hand m&oacute;da</p>
      <p style="margin: 8px 0 0;">
        <a href="${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}" style="color: #999; text-decoration: underline;">Odhl&aacute;sit se z odb&ecaron;ru</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Build HTML for "new items matching your request just arrived" email.
 * Used by the /api/cron/similar-items cron when new products match
 * a ProductNotifyRequest's category + sizes.
 */
export function buildSimilarItemsArrivedHtml(
  matchedProducts: SimilarProduct[],
  recipientEmail: string,
): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  const cards = matchedProducts.slice(0, 3).map((p) => {
    const productUrl = `${baseUrl}/products/${p.slug}`;
    let firstImage: string | null = null;
    try {
      const imgs: string[] = JSON.parse(p.images);
      firstImage = imgs[0] ?? null;
    } catch {
      /* ignore */
    }

    const imageHtml = firstImage
      ? `<img src="${escapeHtml(firstImage)}" alt="${escapeHtml(p.name)}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px 8px 0 0; display: block;" />`
      : `<div style="width: 100%; height: 200px; background: #f5f5f5; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center;"><span style="font-size: 40px;">&#128087;</span></div>`;

    const discount =
      p.compareAt && p.compareAt > p.price
        ? Math.round(((p.compareAt - p.price) / p.compareAt) * 100)
        : null;

    const priceHtml = discount
      ? `<span style="text-decoration: line-through; color: #999; font-size: 11px;">${formatPriceCzk(p.compareAt!)}</span> <strong style="color: #dc2626; font-size: 14px;">${formatPriceCzk(p.price)}</strong>`
      : `<strong style="color: #1a1a1a; font-size: 14px;">${formatPriceCzk(p.price)}</strong>`;

    const conditionLabel = CONDITION_LABELS[p.condition] ?? p.condition;
    let sizesArr: string[] = [];
    try {
      sizesArr = JSON.parse(p.sizes);
    } catch {
      /* ignore */
    }
    const sizesText = sizesArr.length > 0 ? sizesArr.join(", ") : null;

    return `
      <td style="width: 33%; padding: 6px; vertical-align: top;">
        <a href="${productUrl}" style="text-decoration: none; display: block; border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden;">
          ${imageHtml}
          <div style="padding: 10px;">
            <p style="margin: 0; color: #1a1a1a; font-size: 13px; font-weight: 600; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</p>
            ${p.brand ? `<p style="margin: 2px 0 0; color: #888; font-size: 11px;">${escapeHtml(p.brand)}</p>` : ""}
            <p style="margin: 2px 0 0; color: #666; font-size: 11px;">${escapeHtml(conditionLabel)}${sizesText ? ` &middot; Vel.: ${escapeHtml(sizesText)}` : ""}</p>
            <p style="margin: 6px 0 0;">${priceHtml}</p>
          </div>
        </a>
      </td>`;
  });

  const rows: string[] = [];
  for (let i = 0; i < cards.length; i += 3) {
    const cells = [
      cards[i],
      cards[i + 1] ?? '<td style="width: 33%; padding: 6px;"></td>',
      cards[i + 2] ?? '<td style="width: 33%; padding: 6px;"></td>',
    ];
    rows.push(`<tr>${cells.join("")}</tr>`);
  }

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="text-decoration: none;">
        <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Jani&ccaron;ka Shop</h1>
      </a>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

      <div style="text-align: center;">
        <div style="width: 64px; height: 64px; background: #dcfce7; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#10024;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Pr&aacute;v&ecaron; p&rcaron;idáno!</h2>
        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
          Na&scaron;li jsme nov&eacute; kousky, kter&eacute; by se ti mohly l&iacute;bit.
          Ka&zcaron;d&yacute; je unik&aacute;t &mdash; a&zcaron; bude pry&ccaron;, u&zcaron; se nevr&aacute;t&iacute;!
        </p>
      </div>

      <div style="margin-top: 28px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${rows.join("")}
        </table>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${baseUrl}/products?sort=newest" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Zobrazit v&scaron;echny novinky
        </a>
      </div>

    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Jani&ccaron;ka Shop &mdash; Second hand m&oacute;da</p>
      <p style="margin: 8px 0 0;">
        <a href="${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}" style="color: #999; text-decoration: underline;">Odhl&aacute;sit se z odb&ecaron;ru</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send "similar item available" emails to people who requested notifications
 * for categories/sizes matching the sold products. Called after checkout.
 *
 * For each sold product:
 * 1. Find ProductNotifyRequest records matching categoryId + size overlap
 * 2. Query 4 similar available products in the same category
 * 3. Send email with similar product cards
 * 4. Mark matched requests as notified
 */
export async function sendSimilarItemNotifications(
  soldProducts: SoldProduct[],
): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(
      "[Email] RESEND_API_KEY not set — skipping similar item notifications",
    );
    return;
  }

  const db = await getDb();

  for (const soldProduct of soldProducts) {
    try {
      // Parse sold product sizes for overlap check
      let soldSizes: string[] = [];
      try {
        soldSizes = JSON.parse(soldProduct.sizes);
      } catch {
        /* ignore corrupted JSON */
      }

      // Find notify requests for the same category that haven't been notified yet
      const requests = await db.productNotifyRequest.findMany({
        where: {
          categoryId: soldProduct.categoryId,
          notified: false,
        },
      });

      if (requests.length === 0) continue;

      // Filter by size overlap in JS (sizes stored as JSON arrays)
      const matchedRequests = requests.filter((req) => {
        try {
          const reqSizes: string[] = JSON.parse(req.sizes);
          // If either side has no size preference, match anyway
          if (reqSizes.length === 0 || soldSizes.length === 0) return true;
          return reqSizes.some((s) => soldSizes.includes(s));
        } catch {
          return true; // corrupted JSON — include to be safe
        }
      });

      if (matchedRequests.length === 0) continue;

      // Query similar available products in the same category
      const similarProducts = await db.product.findMany({
        where: {
          categoryId: soldProduct.categoryId,
          active: true,
          sold: false,
          id: { not: soldProduct.id },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          name: true,
          slug: true,
          price: true,
          compareAt: true,
          brand: true,
          condition: true,
          images: true,
          sizes: true,
        },
      });

      // Never send empty recommendation emails
      if (similarProducts.length === 0) continue;

      // Send email to each matched request
      const requestIds: string[] = [];
      for (const req of matchedRequests) {
        try {
          const subject = `${soldProduct.brand ? `${soldProduct.brand} ` : ""}${soldProduct.name} je pryč — ale máme tohle`;

          await resend.emails.send({
            from: NEWSLETTER_FROM_EMAIL,
            to: req.email,
            subject,
            html: buildSimilarItemHtml(
              soldProduct,
              similarProducts,
              req.email,
            ),
          });

          requestIds.push(req.id);
        } catch (err) {
          console.error(
            `[Email] Failed to send similar item notification to ${req.email}:`,
            err,
          );
        }
      }

      // Mark successfully notified requests
      if (requestIds.length > 0) {
        await db.productNotifyRequest.updateMany({
          where: { id: { in: requestIds } },
          data: { notified: true },
        });
      }
    } catch (err) {
      console.error(
        `[Email] Similar item notification failed for product ${soldProduct.id}:`,
        err,
      );
    }
  }
}
