import { getMailer } from "@/lib/email/resend-transport";
import { FROM_NEWSLETTER, REPLY_TO } from "@/lib/email/addresses";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";
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

interface PriceDropProductSnapshot {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  images: string;
}

function parseFirstImage(images: string): string | null {
  try {
    const arr: string[] = JSON.parse(images);
    return arr[0] ?? null;
  } catch {
    return null;
  }
}

function buildPriceDropHtml(
  product: PriceDropProductSnapshot,
  oldPrice: number,
  newPrice: number,
  unsubscribeUrl: string,
): string {
  const baseUrl = getBaseUrl();
  const productUrl = `${baseUrl}/products/${product.slug}`;
  const firstImage = parseFirstImage(product.images);
  const fullName = `${product.brand ? `${product.brand} ` : ""}${product.name}`;
  const savingsAbs = Math.max(0, oldPrice - newPrice);
  const savingsPct = oldPrice > 0 ? Math.round((savingsAbs / oldPrice) * 100) : 0;

  const imageHtml = firstImage
    ? `<img src="${escapeHtml(firstImage)}" alt="${escapeHtml(product.name)}" width="240" style="width: 240px; max-width: 100%; height: 280px; object-fit: cover; border-radius: 12px; display: block; margin: 0 auto; border: 1px solid ${BRAND.borderSoft};" />`
    : "";

  const content = `
    <div style="text-align: center;">
      ${renderEyebrow("Cena šla dolů")}
      ${renderDisplayHeading("Tvůj hlídaný kousek zlevnil.")}
      <p style="margin: 0 0 20px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
        Hlídala jsi <strong style="color: ${BRAND.charcoal};">${escapeHtml(fullName)}</strong> — právě jsem mu snížila cenu.
      </p>
      ${imageHtml}
      <div style="margin: 24px auto 8px; padding: 18px 24px; background: ${BRAND.blush}; border-radius: 14px; display: inline-block;">
        <p style="margin: 0 0 4px; font-family: ${FONTS.sans}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.14em; color: ${BRAND.primaryDark};">Nová cena</p>
        <p style="margin: 0; font-family: ${FONTS.serif}; font-size: 32px; font-weight: 700; color: ${BRAND.primary}; line-height: 1.1;">${formatPriceCzk(newPrice)}</p>
        <p style="margin: 6px 0 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoalSoft};">
          <span style="text-decoration: line-through;">${formatPriceCzk(oldPrice)}</span>
          ${savingsAbs > 0 ? `&nbsp;·&nbsp;<strong style="color: ${BRAND.primaryDark};">ušetříš ${formatPriceCzk(savingsAbs)}${savingsPct > 0 ? ` (${savingsPct}%)` : ""}</strong>` : ""}
        </p>
      </div>
      <p style="margin: 18px 0 0; font-family: ${FONTS.serif}; font-style: italic; font-size: 15px; color: ${BRAND.primary};">
        Každý kousek je unikát — kdo dřív přijde, ten dřív bere.
      </p>
    </div>

    <div style="margin: 28px 0 8px;">
      ${renderButton({ href: productUrl, label: "Koupit za novou cenu", variant: "primary" })}
    </div>`;

  return renderLayout({
    preheader: `${fullName} zlevnil — nyní ${formatPriceCzk(newPrice)}`,
    contentHtml: content,
    unsubscribeUrl,
    unsubscribeText: "Tenhle email ti chodí, protože sis nastavila hlídání ceny.",
  });
}

export async function sendPriceDropEmail(
  to: string,
  data: {
    product: PriceDropProductSnapshot;
    oldPrice: number;
    newPrice: number;
    unsubToken: string;
  },
): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[PriceDrop] RESEND_API_KEY not set — skipping email");
    return false;
  }

  const baseUrl = getBaseUrl();
  const unsubscribeUrl = `${baseUrl}/api/price-watch/unsubscribe?token=${encodeURIComponent(data.unsubToken)}`;
  const fullName = `${data.product.brand ? `${data.product.brand} ` : ""}${data.product.name}`;
  const subject = `${fullName} zlevnil na ${formatPriceCzk(data.newPrice)}`;

  try {
    await mailer.sendMail({
      from: FROM_NEWSLETTER,
      replyTo: REPLY_TO,
      to,
      subject,
      html: buildPriceDropHtml(data.product, data.oldPrice, data.newPrice, unsubscribeUrl),
    });
    return true;
  } catch (err) {
    logger.error(`[PriceDrop] Failed to send to ${to}:`, err);
    return false;
  }
}

/**
 * Fan-out price-drop emails. Called fire-and-forget from admin actions after
 * a Product price update where new < old. Only watchers whose stored
 * currentPrice > newPrice are notified — guards against re-notifying after the
 * watcher already received an email at this price tier.
 */
export async function triggerPriceWatchEmails(
  productId: string,
  newPrice: number,
): Promise<{ notified: number; skipped: number }> {
  let notified = 0;
  let skipped = 0;

  try {
    const db = await getDb();
    const product = await db.product.findUnique({
      where: { id: productId },
      select: { id: true, slug: true, name: true, brand: true, images: true, sold: true },
    });
    if (!product || product.sold) return { notified: 0, skipped: 0 };

    const watchers = await db.priceWatch.findMany({
      where: { productId, currentPrice: { gt: newPrice } },
      select: { id: true, email: true, currentPrice: true, unsubToken: true },
    });
    if (watchers.length === 0) return { notified: 0, skipped: 0 };

    for (const w of watchers) {
      const ok = await sendPriceDropEmail(w.email, {
        product,
        oldPrice: w.currentPrice,
        newPrice,
        unsubToken: w.unsubToken,
      });
      if (ok) {
        notified++;
        try {
          await db.priceWatch.update({
            where: { id: w.id },
            data: { currentPrice: newPrice },
          });
        } catch (err) {
          logger.error(`[PriceDrop] Failed to update watcher ${w.id}:`, err);
        }
      } else {
        skipped++;
      }
    }
  } catch (err) {
    logger.error(`[PriceDrop] Fan-out failed for product ${productId}:`, err);
  }

  return { notified, skipped };
}

/**
 * Called from checkout when products are marked sold. For each sold product
 * the watcher email mirrors the wishlist-sold notification ("Bohužel prodáno
 * + 3 podobné"), then the PriceWatch row is deleted so the watcher isn't
 * re-emailed by any future admin action on the same product id.
 *
 * The per-watcher email body re-uses buildWishlistSoldHtml so we get the same
 * three-similar-items grid for free; this keeps the system surface small.
 */
export async function sweepSoldPriceWatchers(
  soldProducts: Array<{
    id: string;
    name: string;
    brand: string | null;
    categoryId: string;
    sizes: string;
    images: string;
  }>,
): Promise<void> {
  if (soldProducts.length === 0) return;
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[PriceDrop] RESEND_API_KEY not set — skipping sold sweep");
    return;
  }

  const { buildWishlistSoldHtml } = await import("@/lib/email/wishlist-sold");
  const db = await getDb();

  for (const sold of soldProducts) {
    try {
      const watchers = await db.priceWatch.findMany({
        where: { productId: sold.id },
        select: { id: true, email: true },
      });
      if (watchers.length === 0) continue;

      let soldSizes: string[] = [];
      try { soldSizes = JSON.parse(sold.sizes); } catch { /* ignore */ }

      const candidates = await db.product.findMany({
        where: {
          categoryId: sold.categoryId,
          active: true,
          sold: false,
          id: { not: sold.id },
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
            const cs: string[] = JSON.parse(c.sizes);
            if (cs.some((s) => soldSizes.includes(s))) score += 10;
          } catch { /* ignore */ }
        }
        if (sold.brand && c.brand === sold.brand) score += 3;
        return { c, score };
      });
      scored.sort((a, b) => b.score - a.score);
      const similarProducts = scored.slice(0, 3).map((s) => s.c);

      const subject = `${sold.brand ? `${sold.brand} ` : ""}${sold.name} se právě prodal`;

      for (const w of watchers) {
        try {
          await mailer.sendMail({
            from: FROM_NEWSLETTER,
            replyTo: REPLY_TO,
            to: w.email,
            subject,
            html: buildWishlistSoldHtml(sold, similarProducts, w.email),
          });
        } catch (err) {
          logger.error(`[PriceDrop] sold-sweep send failed to ${w.email}:`, err);
        }
      }

      // Delete watchers — product is gone, future admin price changes are no-ops.
      await db.priceWatch.deleteMany({ where: { productId: sold.id } });
    } catch (err) {
      logger.error(`[PriceDrop] sold-sweep failed for product ${sold.id}:`, err);
    }
  }
}
