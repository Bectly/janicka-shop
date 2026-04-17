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

function parseFirstImage(images: string): string | null {
  try {
    const imgs: string[] = JSON.parse(images);
    return imgs[0] ?? null;
  } catch {
    return null;
  }
}

function buildWishlistSoldHtml(
  soldProduct: SoldProduct,
  similarProducts: SimilarProduct[],
  recipientEmail: string,
): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  const soldName = `${soldProduct.brand ? `${escapeHtml(soldProduct.brand)} ` : ""}${escapeHtml(soldProduct.name)}`;
  const soldImage = parseFirstImage(soldProduct.images);

  const soldImageHtml = soldImage
    ? `<img src="${escapeHtml(soldImage)}" alt="${escapeHtml(soldProduct.name)}" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; display: block; margin: 0 auto; filter: grayscale(100%); opacity: 0.7;" />`
    : "";

  const cards = similarProducts.map((p) => {
    const productUrl = `${baseUrl}/products/${p.slug}`;
    const firstImage = parseFirstImage(p.images);

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

  const cells = [
    cards[0],
    cards[1] ?? '<td style="width: 33%; padding: 6px;"></td>',
    cards[2] ?? '<td style="width: 33%; padding: 6px;"></td>',
  ];
  const row = `<tr>${cells.join("")}</tr>`;

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
        ${soldImageHtml}
        <div style="width: 64px; height: 64px; background: #fee2e2; border-radius: 50%; margin: 16px auto; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#128148;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Tv\u016fj vysn\u011bn\u00fd kousek se pr\u00e1v\u011b prodal</h2>
        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
          <strong>${soldName}</strong> u&zcaron; na&scaron;el novou majitelku. &#128549;<br/>
          Ale ne&ccaron;ekej na dal&scaron;&iacute; &mdash; m&aacute;me pro tebe podobn&eacute; kousky, kter&eacute; ti mohou padnout stejn&ecaron;.
        </p>
      </div>

      <div style="margin-top: 28px;">
        <h3 style="margin: 0 0 12px; font-size: 16px; color: #1a1a1a; text-align: center;">Pod\u00edvej se na podobn\u00e9</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${row}
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
        <a href="${baseUrl}/odhlasit-novinky?token=${signUnsubscribeToken(recipientEmail)}" style="color: #999; text-decoration: underline;">Odhl&aacute;sit se z odb&ecaron;ru</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * For each sold product, notify all wishlist subscribers with 3 similar
 * available items in the same category. Marks subscriptions as notified
 * so users aren't re-emailed if the record sticks around.
 * Called fire-and-forget from checkout after products are marked sold.
 */
export async function sendWishlistSoldNotifications(
  soldProducts: SoldProduct[],
): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.warn(
      "[Email] RESEND_API_KEY not set — skipping wishlist sold notifications",
    );
    return;
  }

  const db = await getDb();

  for (const soldProduct of soldProducts) {
    try {
      const subscribers = await db.wishlistSubscription.findMany({
        where: { productId: soldProduct.id, notifiedAt: null },
        select: { id: true, email: true },
      });
      if (subscribers.length === 0) continue;

      // Parse sold sizes so we can prefer similar items in same size range
      let soldSizes: string[] = [];
      try {
        soldSizes = JSON.parse(soldProduct.sizes);
      } catch {
        /* ignore corrupted JSON */
      }

      // Query up to 12 candidates, filter by size overlap in JS, take top 3
      const candidates = await db.product.findMany({
        where: {
          categoryId: soldProduct.categoryId,
          active: true,
          sold: false,
          id: { not: soldProduct.id },
        },
        orderBy: { createdAt: "desc" },
        take: 12,
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

      const scored = candidates.map((c) => {
        let score = 0;
        if (soldSizes.length > 0) {
          try {
            const cSizes: string[] = JSON.parse(c.sizes);
            if (cSizes.some((s) => soldSizes.includes(s))) score += 10;
          } catch {
            /* ignore */
          }
        }
        if (soldProduct.brand && c.brand === soldProduct.brand) score += 3;
        return { c, score };
      });
      scored.sort((a, b) => b.score - a.score);
      const similarProducts = scored.slice(0, 3).map((s) => s.c);

      if (similarProducts.length === 0) continue;

      const subject = `Tv\u016fj vysn\u011bn\u00fd kousek se pr\u00e1v\u011b prodal \u2014 pod\u00edvej se na podobn\u00e9`;

      const notifiedIds: string[] = [];
      for (const sub of subscribers) {
        try {
          await resend.emails.send({
            from: NEWSLETTER_FROM_EMAIL,
            to: sub.email,
            subject,
            html: buildWishlistSoldHtml(
              soldProduct,
              similarProducts,
              sub.email,
            ),
          });
          notifiedIds.push(sub.id);
        } catch (err) {
          console.error(
            `[Email] Failed to send wishlist sold email to ${sub.email}:`,
            err,
          );
        }
      }

      if (notifiedIds.length > 0) {
        await db.wishlistSubscription.updateMany({
          where: { id: { in: notifiedIds } },
          data: { notifiedAt: new Date() },
        });
      }
    } catch (err) {
      console.error(
        `[Email] Wishlist sold notification failed for product ${soldProduct.id}:`,
        err,
      );
    }
  }
}
