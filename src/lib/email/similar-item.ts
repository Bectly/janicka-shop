import { getMailer } from "@/lib/email/resend-transport";
import { FROM_NEWSLETTER, REPLY_TO } from "@/lib/email/addresses";
import { getDb } from "@/lib/db";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { checkAndRecordEmailDispatch } from "@/lib/email-dedup";
import { logger } from "@/lib/logger";
import { CONDITION_LABELS } from "@/lib/constants";
import {
  escapeHtml,
  getBaseUrl,
  renderButton,
  renderDisplayHeading,
  renderEyebrow,
  renderLayout,
  renderProductGrid,
  BRAND,
  FONTS,
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

function firstImage(images: string): string | null {
  try {
    const imgs: string[] = JSON.parse(images);
    return imgs[0] ?? null;
  } catch {
    return null;
  }
}

function parseSizes(sizes: string): string[] {
  try {
    const arr: string[] = JSON.parse(sizes);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function productMeta(p: SimilarProduct): string {
  const conditionLabel = CONDITION_LABELS[p.condition] ?? p.condition;
  const sizes = parseSizes(p.sizes);
  return sizes.length > 0
    ? `${conditionLabel} · vel. ${sizes.join(", ")}`
    : conditionLabel;
}

function toGridItems(products: SimilarProduct[], baseUrl: string) {
  return products.map((p) => ({
    name: p.name,
    brand: p.brand,
    meta: productMeta(p),
    url: `${baseUrl}/products/${p.slug}`,
    image: firstImage(p.images),
    price: p.price,
    compareAt: p.compareAt,
  }));
}

export function buildSimilarItemHtml(
  soldProduct: SoldProduct,
  similarProducts: SimilarProduct[],
  recipientEmail: string,
): string {
  const baseUrl = getBaseUrl();
  const soldName = `${soldProduct.brand ? `${soldProduct.brand} ` : ""}${soldProduct.name}`;
  const unsubscribeUrl = `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}`;

  const gridItems = toGridItems(similarProducts, baseUrl);

  const contentHtml = `
    ${renderEyebrow("Už je pryč")}
    ${renderDisplayHeading(`${soldName} našel novou majitelku`)}
    <p style="margin: 0 0 20px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Kousek, který tě zajímal, už má nový domov. Vybrala jsem pro tebe podobné &mdash; každý je unikát,
      jeden kus, a až bude pryč, už se nevrátí.
    </p>

    <div style="margin: 24px 0 8px;">
      <p style="margin: 0 0 4px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: ${BRAND.primary};">Mohlo by se ti líbit</p>
    </div>
    ${renderProductGrid(gridItems, 2)}

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: `${baseUrl}/products?sort=newest`, label: "Prohlédnout novinky", variant: "primary" })}
    </div>
  `;

  return renderLayout({
    preheader: `${escapeHtml(soldName)} je pryč — ale mám pro tebe podobné kousky.`,
    contentHtml,
    unsubscribeUrl,
    unsubscribeText: "Tenhle email ti chodí, protože jsi požádala o upozornění na podobné kousky.",
  });
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
  const baseUrl = getBaseUrl();
  const unsubscribeUrl = `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}`;

  const gridItems = toGridItems(matchedProducts.slice(0, 3), baseUrl);

  const contentHtml = `
    ${renderEyebrow("Právě přidáno")}
    ${renderDisplayHeading("Něco nového pro tebe")}
    <p style="margin: 0 0 20px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Našla jsem nové kousky, které odpovídají tomu, co hledáš. Každý je unikát &mdash;
      jeden kus, a až bude pryč, už se nevrátí.
    </p>

    ${renderProductGrid(gridItems, gridItems.length >= 3 ? 3 : 2)}

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: `${baseUrl}/products?sort=newest`, label: "Zobrazit všechny novinky", variant: "primary" })}
    </div>
  `;

  return renderLayout({
    preheader: "Nové kousky, které odpovídají tvému hledání.",
    contentHtml,
    unsubscribeUrl,
    unsubscribeText: "Tenhle email ti chodí, protože ses přihlásila k upozornění na nové kousky.",
  });
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
  const mailer = getMailer();
  if (!mailer) {
    logger.warn(
      "[Email] RESEND_API_KEY not set — skipping similar item notifications",
    );
    return;
  }

  const db = await getDb();

  for (const soldProduct of soldProducts) {
    try {
      const soldSizes = parseSizes(soldProduct.sizes);

      const requests = await db.productNotifyRequest.findMany({
        where: {
          categoryId: soldProduct.categoryId,
          notified: false,
        },
      });

      if (requests.length === 0) continue;

      const matchedRequests = requests.filter((req) => {
        const reqSizes = parseSizes(req.sizes);
        if (reqSizes.length === 0 || soldSizes.length === 0) return true;
        return reqSizes.some((s) => soldSizes.includes(s));
      });

      if (matchedRequests.length === 0) continue;

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

      if (similarProducts.length === 0) continue;

      const requestIds: string[] = [];
      for (const req of matchedRequests) {
        try {
          const allowed = await checkAndRecordEmailDispatch(
            req.email,
            soldProduct.id,
            "similar-item-arrived",
          );
          if (!allowed) {
            requestIds.push(req.id);
            continue;
          }

          const subject = `${soldProduct.brand ? `${soldProduct.brand} ` : ""}${soldProduct.name} je pryč — mám pro tebe podobné`;

          await mailer.sendMail({
            from: FROM_NEWSLETTER,
            replyTo: REPLY_TO,
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
          logger.error(
            `[Email] Failed to send similar item notification to ${req.email}:`,
            err,
          );
        }
      }

      if (requestIds.length > 0) {
        await db.productNotifyRequest.updateMany({
          where: { id: { in: requestIds } },
          data: { notified: true },
        });
      }
    } catch (err) {
      logger.error(
        `[Email] Similar item notification failed for product ${soldProduct.id}:`,
        err,
      );
    }
  }
}
