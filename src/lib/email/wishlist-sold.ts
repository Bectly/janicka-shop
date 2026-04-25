import { getMailer } from "@/lib/email/smtp-transport";
import { FROM_NEWSLETTER, REPLY_TO } from "@/lib/email/addresses";
import { getDb } from "@/lib/db";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { logger } from "@/lib/logger";
import { CONDITION_LABELS } from "@/lib/constants";
import {
  BRAND,
  FONTS,
  getBaseUrl,
  escapeHtml,
  formatPriceCzk,
  renderLayout,
  renderButton,
  renderEyebrow,
  renderDisplayHeading,
} from "@/lib/email/layout";

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

function buildSimilarCard(p: SimilarProduct, baseUrl: string): string {
  const productUrl = `${baseUrl}/products/${p.slug}`;
  const firstImage = parseFirstImage(p.images);

  const imageHtml = firstImage
    ? `<img src="${escapeHtml(firstImage)}" alt="${escapeHtml(p.name)}" width="180" style="width: 100%; height: 200px; object-fit: cover; display: block; border: 0;" />`
    : `<div style="width: 100%; height: 200px; background: ${BRAND.blush}; line-height: 200px; text-align: center; font-family: ${FONTS.serif}; font-style: italic; font-size: 48px; color: ${BRAND.primaryLight};">J</div>`;

  const discount =
    p.compareAt && p.compareAt > p.price
      ? Math.round(((p.compareAt - p.price) / p.compareAt) * 100)
      : null;

  const priceHtml = discount
    ? `<span style="text-decoration: line-through; color: ${BRAND.charcoalMuted}; font-size: 12px;">${formatPriceCzk(p.compareAt!)}</span> <strong style="color: ${BRAND.primary}; font-family: ${FONTS.serif}; font-size: 16px; font-weight: 700;">${formatPriceCzk(p.price)}</strong>`
    : `<strong style="color: ${BRAND.charcoal}; font-family: ${FONTS.serif}; font-size: 16px; font-weight: 700;">${formatPriceCzk(p.price)}</strong>`;

  const conditionLabel = CONDITION_LABELS[p.condition] ?? p.condition;
  let sizesArr: string[] = [];
  try {
    sizesArr = JSON.parse(p.sizes);
  } catch {
    /* ignore */
  }
  const sizesText = sizesArr.length > 0 ? sizesArr.join(", ") : null;

  return `
    <td style="width: 33.33%; padding: 6px; vertical-align: top;">
      <a href="${productUrl}" style="text-decoration: none; display: block; border: 1px solid ${BRAND.borderSoft}; border-radius: 10px; overflow: hidden; background: ${BRAND.white};">
        ${imageHtml}
        <div style="padding: 12px;">
          ${p.brand ? `<p style="margin: 0 0 2px; font-family: ${FONTS.sans}; color: ${BRAND.primary}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;">${escapeHtml(p.brand)}</p>` : ""}
          <p style="margin: 0; font-family: ${FONTS.serif}; color: ${BRAND.charcoal}; font-size: 14px; font-weight: 600; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</p>
          <p style="margin: 4px 0 8px; font-family: ${FONTS.sans}; color: ${BRAND.charcoalSoft}; font-size: 11px;">${escapeHtml(conditionLabel)}${sizesText ? ` &middot; vel. ${escapeHtml(sizesText)}` : ""}</p>
          <p style="margin: 0;">${priceHtml}</p>
        </div>
      </a>
    </td>`;
}

export function buildWishlistSoldHtml(
  soldProduct: SoldProduct,
  similarProducts: SimilarProduct[],
  recipientEmail: string,
): string {
  const baseUrl = getBaseUrl();
  const unsubscribeUrl = `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}`;

  const soldName = `${soldProduct.brand ? `${soldProduct.brand} ` : ""}${soldProduct.name}`;
  const soldImage = parseFirstImage(soldProduct.images);

  const soldImageHtml = soldImage
    ? `<img src="${escapeHtml(soldImage)}" alt="${escapeHtml(soldProduct.name)}" width="140" style="width: 140px; height: 140px; object-fit: cover; border-radius: 12px; display: block; margin: 0 auto; filter: grayscale(100%); opacity: 0.75; border: 1px solid ${BRAND.borderSoft};" />`
    : "";

  const cells = [
    similarProducts[0] ? buildSimilarCard(similarProducts[0], baseUrl) : `<td style="width: 33.33%; padding: 6px;"></td>`,
    similarProducts[1] ? buildSimilarCard(similarProducts[1], baseUrl) : `<td style="width: 33.33%; padding: 6px;"></td>`,
    similarProducts[2] ? buildSimilarCard(similarProducts[2], baseUrl) : `<td style="width: 33.33%; padding: 6px;"></td>`,
  ];

  const content = `
    <div style="text-align: center;">
      ${soldImageHtml}
      <div style="margin-top: 20px;"></div>
      ${renderEyebrow("Kousek se prodal")}
      ${renderDisplayHeading("Někdo byl rychlejší.")}
      <p style="margin: 0 0 8px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
        <strong style="color: ${BRAND.charcoal};">${escapeHtml(soldName)}</strong> už má novou majitelku.
      </p>
      <p style="margin: 0 0 24px; font-family: ${FONTS.serif}; font-style: italic; font-size: 16px; color: ${BRAND.primary};">
        Ale mám pro tebe pár kousků, které by ti mohly padnout stejně.
      </p>
    </div>

    <div style="margin-top: 12px;">
      <p style="margin: 0 0 14px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: ${BRAND.primary}; text-align: center;">Podobné kousky</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: separate; border-spacing: 0;">
        <tr>${cells.join("")}</tr>
      </table>
    </div>

    <div style="margin: 32px 0 8px;">
      ${renderButton({ href: `${baseUrl}/products?sort=newest`, label: "Prohlédnout všechny novinky", variant: "primary" })}
    </div>`;

  return renderLayout({
    preheader: `${soldName} se prodal. Tady jsou podobné kousky.`,
    contentHtml: content,
    unsubscribeUrl,
  });
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
  const mailer = getMailer();
  if (!mailer) {
    logger.warn(
      "[Email] SMTP not configured — skipping wishlist sold notifications",
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

      let soldSizes: string[] = [];
      try {
        soldSizes = JSON.parse(soldProduct.sizes);
      } catch {
        /* ignore corrupted JSON */
      }

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

      const subject = `Tvůj vysněný kousek se právě prodal — podívej se na podobné`;

      const notifiedIds: string[] = [];
      for (const sub of subscribers) {
        try {
          await mailer.sendMail({
            from: FROM_NEWSLETTER,
            replyTo: REPLY_TO,
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
          logger.error(
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
      logger.error(
        `[Email] Wishlist sold notification failed for product ${soldProduct.id}:`,
        err,
      );
    }
  }
}
