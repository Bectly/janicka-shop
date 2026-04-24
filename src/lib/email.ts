import { getMailer } from "@/lib/email/smtp-transport";
import {
  FROM_ORDERS,
  FROM_INFO,
  FROM_NEWSLETTER,
  FROM_SUPPORT,
  REPLY_TO,
} from "@/lib/email/addresses";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { logger } from "@/lib/logger";
import {
  BRAND,
  FONTS,
  getBaseUrl,
  renderLayout,
  renderButton,
  renderDivider,
  renderEyebrow,
  renderDisplayHeading,
  renderInfoCard,
  renderProductRowList,
  renderProductGrid,
  renderTagPill,
} from "@/lib/email/layout";

interface OrderItem {
  name: string;
  price: number;
  size: string | null;
  color: string | null;
}

interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: string;
  shippingMethod: string;
  shippingName: string | null;
  shippingStreet: string | null;
  shippingCity: string | null;
  shippingZip: string | null;
  shippingPointId: string | null;
  note: string | null;
  accessToken: string;
  isCod: boolean;
  expectedDeliveryDate: Date | null;
}

function formatPriceCzk(price: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

const PAYMENT_LABELS: Record<string, string> = {
  comgate: "Online platba",
  card: "Kartou",
  bank_transfer: "Bankovní převod",
  cod: "Dobírka",
};

const SHIPPING_LABELS: Record<string, string> = {
  packeta_pickup: "Zásilkovna — výdejní místo",
  packeta_home: "Zásilkovna — na adresu",
  czech_post: "Česká pošta",
};

function buildOrderConfirmationHtml(data: OrderEmailData): string {
  const baseUrl = getBaseUrl();
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;

  const itemsHtml = data.items
    .map(
      (item, i) => `
      <tr>
        <td style="padding: 14px 0; border-top: ${i === 0 ? "none" : `1px solid ${BRAND.borderSoft}`}; font-family: ${FONTS.sans};">
          <div style="font-family: ${FONTS.serif}; font-size: 17px; font-weight: 600; color: ${BRAND.charcoal}; line-height: 1.3;">${escapeHtml(item.name)}</div>
          ${(item.size || item.color) ? `<div style="margin-top: 4px; font-size: 13px; color: ${BRAND.charcoalSoft};">${item.size ? escapeHtml(item.size) : ""}${item.size && item.color ? " &middot; " : ""}${item.color ? escapeHtml(item.color) : ""}</div>` : ""}
        </td>
        <td style="padding: 14px 0; border-top: ${i === 0 ? "none" : `1px solid ${BRAND.borderSoft}`}; text-align: right; white-space: nowrap; vertical-align: top; font-family: ${FONTS.sans}; font-size: 15px; color: ${BRAND.charcoal};">
          ${formatPriceCzk(item.price)}
        </td>
      </tr>`,
    )
    .join("");

  const paymentLabel = PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod;
  const shippingLabel = SHIPPING_LABELS[data.shippingMethod] ?? data.shippingMethod;

  let shippingAddressHtml: string;
  if (data.shippingMethod === "packeta_pickup" && data.shippingPointId) {
    shippingAddressHtml = `
      <div style="margin: 6px 0 0; font-family: ${FONTS.sans}; font-size: 14px; color: ${BRAND.charcoal}; line-height: 1.5;">
        ${escapeHtml(data.shippingStreet ?? "")}
        <div style="color: ${BRAND.charcoalSoft}; font-size: 12px;">Výdejní místo #${escapeHtml(data.shippingPointId)}</div>
      </div>`;
  } else {
    shippingAddressHtml = `
      <div style="margin: 6px 0 0; font-family: ${FONTS.sans}; font-size: 14px; color: ${BRAND.charcoal}; line-height: 1.5;">
        ${escapeHtml(data.shippingName ?? "")}<br/>
        ${escapeHtml(data.shippingStreet ?? "")}<br/>
        ${escapeHtml(data.shippingZip ?? "")} ${escapeHtml(data.shippingCity ?? "")}
      </div>`;
  }

  const codFee = data.isCod ? data.total - data.subtotal - data.shipping : 0;

  const statusCard = data.isCod
    ? renderInfoCard(
        `<p style="margin: 0; font-family: ${FONTS.sans}; font-size: 14px; color: ${BRAND.charcoal}; line-height: 1.6;"><strong style="color: ${BRAND.warning};">Platba na dobírku.</strong> Částku ${formatPriceCzk(data.total)} uhradíš při převzetí zásilky.</p>`,
        "warning",
      )
    : renderInfoCard(
        `<p style="margin: 0; font-family: ${FONTS.sans}; font-size: 14px; color: ${BRAND.charcoal}; line-height: 1.6;"><strong style="color: ${BRAND.primary};">Čekáme na platbu.</strong> Jakmile ji přijmeme, ozveme se dalším emailem a kousek ti zabalíme.</p>`,
        "blush",
      );

  const content = `
    ${renderEyebrow(`Objednávka ${data.orderNumber}`)}
    ${renderDisplayHeading(`Děkujeme, ${escapeHtml(data.customerName.split(" ")[0] || data.customerName)}.`)}
    <p style="margin: 0 0 20px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Máš u mě kousek, který už nikdo jiný mít nebude. Potvrzuju příjem objednávky a brzy ti dám vědět další krok.
    </p>

    ${statusCard}

    <!-- Items -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0 0; border-collapse: collapse;">
      <tr>
        <td colspan="2" style="padding: 0 0 10px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: ${BRAND.primary}; border-bottom: 1px solid ${BRAND.border};">
          Tvoje kousky
        </td>
      </tr>
      ${itemsHtml}
    </table>

    <!-- Totals -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 18px 0 0; border-collapse: collapse; font-family: ${FONTS.sans};">
      <tr>
        <td style="padding: 4px 0; font-size: 14px; color: ${BRAND.charcoalSoft};">Mezisoučet</td>
        <td style="padding: 4px 0; font-size: 14px; color: ${BRAND.charcoal}; text-align: right;">${formatPriceCzk(data.subtotal)}</td>
      </tr>
      <tr>
        <td style="padding: 4px 0; font-size: 14px; color: ${BRAND.charcoalSoft};">Doprava</td>
        <td style="padding: 4px 0; font-size: 14px; color: ${BRAND.charcoal}; text-align: right;">${data.shipping === 0 ? "Zdarma" : formatPriceCzk(data.shipping)}</td>
      </tr>
      ${codFee > 0 ? `<tr>
        <td style="padding: 4px 0; font-size: 14px; color: ${BRAND.charcoalSoft};">Dobírka</td>
        <td style="padding: 4px 0; font-size: 14px; color: ${BRAND.charcoal}; text-align: right;">${formatPriceCzk(codFee)}</td>
      </tr>` : ""}
      <tr>
        <td style="padding: 14px 0 0; border-top: 2px solid ${BRAND.charcoal}; font-family: ${FONTS.serif}; font-size: 20px; font-weight: 700; color: ${BRAND.charcoal};">Celkem</td>
        <td style="padding: 14px 0 0; border-top: 2px solid ${BRAND.charcoal}; font-family: ${FONTS.serif}; font-size: 22px; font-weight: 700; text-align: right; color: ${BRAND.primary};">${formatPriceCzk(data.total)}</td>
      </tr>
    </table>

    ${renderDivider()}

    <!-- Shipping + Payment -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-family: ${FONTS.sans};">
      <tr>
        <td style="vertical-align: top; padding-right: 16px; width: 50%;">
          ${renderEyebrow("Doprava")}
          <p style="margin: 0; font-size: 14px; color: ${BRAND.charcoal}; line-height: 1.5;">${escapeHtml(shippingLabel)}</p>
          ${shippingAddressHtml}
        </td>
        <td style="vertical-align: top; padding-left: 16px; width: 50%; border-left: 1px solid ${BRAND.borderSoft};">
          ${renderEyebrow("Platba")}
          <p style="margin: 0; font-size: 14px; color: ${BRAND.charcoal}; line-height: 1.5;">${escapeHtml(paymentLabel)}</p>
        </td>
      </tr>
    </table>

    ${data.expectedDeliveryDate ? `
      <div style="margin-top: 24px;">
        ${renderEyebrow("Předpokládané doručení")}
        <p style="margin: 4px 0 0; font-family: ${FONTS.serif}; font-size: 18px; font-weight: 600; color: ${BRAND.primary};">
          do ${new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", year: "numeric" }).format(new Date(data.expectedDeliveryDate))}
        </p>
      </div>` : ""}

    ${data.note ? `
      <div style="margin-top: 24px;">
        ${renderEyebrow("Tvoje poznámka")}
        <p style="margin: 4px 0 0; font-family: ${FONTS.sans}; font-size: 14px; color: ${BRAND.charcoalSoft}; font-style: italic; line-height: 1.6;">&bdquo;${escapeHtml(data.note)}&ldquo;</p>
      </div>` : ""}

    <div style="margin: 36px 0 8px;">
      ${renderButton({ href: orderUrl, label: "Zobrazit objednávku", variant: "primary" })}
    </div>
    <p style="margin: 14px 0 0; font-family: ${FONTS.sans}; font-size: 12px; color: ${BRAND.charcoalMuted}; text-align: center; line-height: 1.6;">
      Dotaz? Odpověz rovnou na tenhle email nebo piš na <a href="mailto:info@janicka.cz" style="color: ${BRAND.charcoalSoft};">info@janicka.cz</a>.
    </p>`;

  return renderLayout({
    preheader: `Tvoje objednávka ${data.orderNumber} je u mě. ${formatPriceCzk(data.total)}.`,
    contentHtml: content,
    footerNote: `Tenhle email ti přišel na <strong>${escapeHtml(data.customerEmail)}</strong>, protože jsi u mě právě objednala.`,
  });
}

function buildPaymentConfirmedHtml(data: Pick<OrderEmailData, "orderNumber" | "customerName" | "total" | "accessToken">): string {
  const baseUrl = getBaseUrl();
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;
  const firstName = data.customerName.split(" ")[0] || data.customerName;

  const content = `
    <div style="text-align: center;">
      ${renderEyebrow("Platba přijata")}
      ${renderDisplayHeading(`Díky, ${escapeHtml(firstName)}!`)}
      <p style="margin: 0 0 20px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
        Tvoje platba za objednávku <strong style="color: ${BRAND.charcoal};">${escapeHtml(data.orderNumber)}</strong>
        ve výši <strong style="color: ${BRAND.primary};">${formatPriceCzk(data.total)}</strong> dorazila v pořádku.
      </p>
      <p style="margin: 0 0 28px; font-family: ${FONTS.serif}; font-style: italic; font-size: 17px; color: ${BRAND.primary};">
        Teď to pečlivě zabalím.
      </p>
      ${renderButton({ href: orderUrl, label: "Zobrazit objednávku", variant: "primary" })}
    </div>`;

  return renderLayout({
    preheader: `Platba ${formatPriceCzk(data.total)} za objednávku ${data.orderNumber} přijata.`,
    contentHtml: content,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Send order confirmation email after checkout.
 * Non-blocking: logs errors instead of throwing (email failure should never block checkout).
 */
export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<void> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping order confirmation email");
    return;
  }

  try {
    await mailer.sendMail({
      from: FROM_ORDERS,
      replyTo: REPLY_TO,
      to: data.customerEmail,
      subject: `Potvrzení objednávky ${data.orderNumber} — Janička Shop`,
      html: buildOrderConfirmationHtml(data),
    });
  } catch (error) {
    logger.error(`[Email] Failed to send order confirmation for ${data.orderNumber}:`, error);
  }
}

/**
 * Send payment confirmed email (triggered by Comgate webhook on PAID status).
 * Non-blocking: logs errors instead of throwing.
 */
export async function sendPaymentConfirmedEmail(data: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  accessToken: string;
}): Promise<void> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping payment confirmed email");
    return;
  }

  try {
    await mailer.sendMail({
      from: FROM_ORDERS,
      replyTo: REPLY_TO,
      to: data.customerEmail,
      subject: `Platba přijata — ${data.orderNumber} — Janička Shop`,
      html: buildPaymentConfirmedHtml(data),
    });
  } catch (error) {
    logger.error(`[Email] Failed to send payment confirmed email for ${data.orderNumber}:`, error);
  }
}

// ---------------------------------------------------------------------------
// Order status change notification emails
// ---------------------------------------------------------------------------

interface StatusEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  accessToken: string;
  trackingNumber?: string | null;
}

function buildStatusEmailWrapper(
  inner: { eyebrow: string; heading: string; bodyHtml: string; extraHtml?: string; preheader: string },
  data: Pick<StatusEmailData, "orderNumber" | "accessToken">,
): string {
  const baseUrl = getBaseUrl();
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;

  const content = `
    <div style="text-align: center;">
      ${renderEyebrow(inner.eyebrow)}
      ${renderDisplayHeading(inner.heading)}
      <div style="font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
        ${inner.bodyHtml}
      </div>
    </div>
    ${inner.extraHtml ?? ""}
    <div style="margin: 32px 0 8px;">
      ${renderButton({ href: orderUrl, label: "Zobrazit objednávku", variant: "primary" })}
    </div>`;

  return renderLayout({ preheader: inner.preheader, contentHtml: content });
}

function buildOrderConfirmedHtml(data: StatusEmailData): string {
  const firstName = data.customerName.split(" ")[0] || data.customerName;
  return buildStatusEmailWrapper({
    eyebrow: "Objednávka potvrzena",
    heading: `Potvrzuju, ${escapeHtml(firstName)}.`,
    bodyHtml: `
      <p style="margin: 0 0 8px;">Tvoji objednávku <strong style="color: ${BRAND.charcoal};">${escapeHtml(data.orderNumber)}</strong> jsem právě potvrdila a chystám ji k odeslání.</p>
      <p style="margin: 12px 0 0; font-size: 14px;">O odeslání ti dám vědět dalším emailem &mdash; s trackovacím číslem.</p>`,
    preheader: `Objednávka ${data.orderNumber} je potvrzena. Připravuji k odeslání.`,
  }, data);
}

function buildOrderShippedHtml(data: StatusEmailData): string {
  const firstName = data.customerName.split(" ")[0] || data.customerName;
  const extraHtml = data.trackingNumber
    ? renderInfoCard(
        `<p style="margin: 0 0 4px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: ${BRAND.primary};">Sledovací číslo</p>
         <p style="margin: 0; font-family: ${FONTS.mono}; font-size: 17px; font-weight: 700; color: ${BRAND.charcoal}; letter-spacing: 0.04em;">${escapeHtml(data.trackingNumber)}</p>`,
        "champagne",
      )
    : "";
  return buildStatusEmailWrapper({
    eyebrow: "Zásilka na cestě",
    heading: `Letí k tobě, ${escapeHtml(firstName)}.`,
    bodyHtml: `
      <p style="margin: 0;">Objednávka <strong style="color: ${BRAND.charcoal};">${escapeHtml(data.orderNumber)}</strong> (${formatPriceCzk(data.total)}) právě vyrazila.</p>
      <p style="margin: 12px 0 0; font-size: 14px;">Stav doručení můžeš sledovat na stránce objednávky.</p>`,
    extraHtml,
    preheader: `Objednávka ${data.orderNumber} právě vyrazila k tobě.`,
  }, data);
}

function buildOrderDeliveredHtml(data: StatusEmailData): string {
  const firstName = data.customerName.split(" ")[0] || data.customerName;
  return buildStatusEmailWrapper({
    eyebrow: "Doručeno",
    heading: `Už je u tebe, ${escapeHtml(firstName)}.`,
    bodyHtml: `
      <p style="margin: 0;">Objednávka <strong style="color: ${BRAND.charcoal};">${escapeHtml(data.orderNumber)}</strong> byla úspěšně doručena.</p>
      <p style="margin: 14px 0 0; font-family: ${FONTS.serif}; font-style: italic; font-size: 17px; color: ${BRAND.primary};">Užij si své nové kousky. Sluší ti to.</p>`,
    preheader: `Objednávka ${data.orderNumber} byla úspěšně doručena.`,
  }, data);
}

function buildOrderCancelledHtml(data: StatusEmailData): string {
  const firstName = data.customerName.split(" ")[0] || data.customerName;
  return buildStatusEmailWrapper({
    eyebrow: "Objednávka zrušena",
    heading: `Zrušeno, ${escapeHtml(firstName)}.`,
    bodyHtml: `
      <p style="margin: 0;">Objednávka <strong style="color: ${BRAND.charcoal};">${escapeHtml(data.orderNumber)}</strong> byla zrušena.</p>
      <p style="margin: 14px 0 0; font-size: 14px;">Kdybys měla dotaz k refundaci nebo cokoli jiného, piš mi na <a href="mailto:info@janicka.cz" style="color: ${BRAND.primary};">info@janicka.cz</a>.</p>`,
    preheader: `Objednávka ${data.orderNumber} byla zrušena.`,
  }, data);
}

const STATUS_EMAIL_BUILDERS: Record<string, (data: StatusEmailData) => string> = {
  confirmed: buildOrderConfirmedHtml,
  shipped: buildOrderShippedHtml,
  delivered: buildOrderDeliveredHtml,
  cancelled: buildOrderCancelledHtml,
};

const STATUS_EMAIL_SUBJECTS: Record<string, string> = {
  confirmed: "Objednávka potvrzena",
  shipped: "Objednávka odeslána",
  delivered: "Objednávka doručena",
  cancelled: "Objednávka zrušena",
};

/**
 * Send status change notification email when admin updates order status.
 * Supports: confirmed, shipped, delivered, cancelled.
 * Non-blocking: logs errors instead of throwing.
 */
export async function sendOrderStatusEmail(
  newStatus: string,
  data: StatusEmailData
): Promise<void> {
  const builder = STATUS_EMAIL_BUILDERS[newStatus];
  const subject = STATUS_EMAIL_SUBJECTS[newStatus];
  if (!builder || !subject) return; // no email for this status (e.g. pending, paid — handled separately)

  const mailer = getMailer();
  if (!mailer) {
    logger.warn(`[Email] SMTP not configured — skipping ${newStatus} email`);
    return;
  }

  try {
    await mailer.sendMail({
      from: FROM_ORDERS,
      replyTo: REPLY_TO,
      to: data.customerEmail,
      subject: `${subject} — ${data.orderNumber} — Janička Shop`,
      html: builder(data),
    });
  } catch (error) {
    logger.error(`[Email] Failed to send ${newStatus} email for ${data.orderNumber}:`, error);
  }
}

// ---------------------------------------------------------------------------
// Enhanced shipping notification with cross-sell recommendations
// ---------------------------------------------------------------------------

interface CrossSellProduct {
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  brand: string | null;
  condition: string;
  image: string | null;
  sizes: string[];
}

export interface ShippingNotificationData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  accessToken: string;
  trackingNumber?: string | null;
  items: OrderItem[];
  crossSellProducts: CrossSellProduct[];
}

function buildCrossSellProductsHtml(products: CrossSellProduct[]): string {
  if (products.length === 0) return "";

  const baseUrl = getBaseUrl();

  const cards = products
    .map((p) => {
      const productUrl = `${baseUrl}/products/${p.slug}`;
      const imageHtml = p.image
        ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" width="240" style="width: 100%; height: 220px; object-fit: cover; display: block; border: 0;" />`
        : `<div style="width: 100%; height: 220px; background: ${BRAND.blush}; display: block; line-height: 220px; text-align: center; font-family: ${FONTS.serif}; font-size: 36px; color: ${BRAND.primaryLight};">&#10022;</div>`;

      const discount = p.compareAt && p.compareAt > p.price
        ? Math.round(((p.compareAt - p.price) / p.compareAt) * 100)
        : null;

      const priceHtml = discount
        ? `<span style="text-decoration: line-through; color: ${BRAND.charcoalMuted}; font-size: 12px;">${formatPriceCzk(p.compareAt!)}</span> <strong style="color: ${BRAND.primary}; font-family: ${FONTS.serif}; font-size: 17px; font-weight: 700;">${formatPriceCzk(p.price)}</strong>`
        : `<strong style="color: ${BRAND.charcoal}; font-family: ${FONTS.serif}; font-size: 17px; font-weight: 700;">${formatPriceCzk(p.price)}</strong>`;

      const conditionLabel = CONDITION_LABELS_SHIPPING[p.condition] ?? p.condition;
      const sizesText = p.sizes.length > 0 ? p.sizes.join(", ") : null;

      return `
        <td style="width: 50%; padding: 8px; vertical-align: top;">
          <a href="${productUrl}" style="text-decoration: none; display: block; border: 1px solid ${BRAND.borderSoft}; border-radius: 12px; overflow: hidden; background: ${BRAND.white};">
            ${imageHtml}
            <div style="padding: 14px 14px 16px;">
              ${p.brand ? `<p style="margin: 0 0 2px; font-family: ${FONTS.sans}; color: ${BRAND.primary}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;">${escapeHtml(p.brand)}</p>` : ""}
              <p style="margin: 0; font-family: ${FONTS.serif}; color: ${BRAND.charcoal}; font-size: 15px; font-weight: 600; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</p>
              <p style="margin: 4px 0 10px; font-family: ${FONTS.sans}; color: ${BRAND.charcoalSoft}; font-size: 11px; line-height: 1.4;">${escapeHtml(conditionLabel)}${sizesText ? ` &middot; vel. ${escapeHtml(sizesText)}` : ""}</p>
              <p style="margin: 0;">${priceHtml}</p>
            </div>
          </a>
        </td>`;
    });

  const rows: string[] = [];
  for (let i = 0; i < cards.length; i += 2) {
    const second = cards[i + 1] ?? '<td style="width: 50%; padding: 8px;"></td>';
    rows.push(`<tr>${cards[i]}${second}</tr>`);
  }

  return `
    <div style="margin-top: 36px; padding-top: 28px; border-top: 1px solid ${BRAND.border};">
      <p style="margin: 0 0 4px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: ${BRAND.primary}; text-align: center;">Vybrala jsem pro tebe</p>
      <h3 style="margin: 0 0 18px; font-family: ${FONTS.serif}; font-size: 22px; font-weight: 600; color: ${BRAND.charcoal}; text-align: center;">Mohlo by se ti líbit</h3>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: separate; border-spacing: 0;">
        ${rows.join("")}
      </table>
      <p style="text-align: center; margin: 20px 0 0;">
        <a href="${baseUrl}/products?sort=newest" style="font-family: ${FONTS.sans}; color: ${BRAND.primary}; font-size: 13px; font-weight: 600; text-decoration: none; border-bottom: 1px solid ${BRAND.primaryLight}; padding-bottom: 2px;">Prohlédnout všechny novinky &rarr;</a>
      </p>
    </div>`;
}

const CONDITION_LABELS_SHIPPING: Record<string, string> = {
  new_with_tags: "Nov\u00e9 s visa\u010dkou",
  new_without_tags: "Nov\u00e9 bez visa\u010dky",
  excellent: "V\u00fdborn\u00fd stav",
  good: "Dobr\u00fd stav",
  visible_wear: "Viditeln\u00e9 opot\u0159eben\u00ed",
};

function buildShippingNotificationHtml(data: ShippingNotificationData): string {
  const baseUrl = getBaseUrl();
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;

  const trackingHtml = data.trackingNumber
    ? renderInfoCard(
        `<p style="margin: 0 0 4px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.14em; color: ${BRAND.primary};">Sledovací číslo</p>
         <p style="margin: 0; font-family: ${FONTS.mono}; font-size: 17px; font-weight: 700; color: ${BRAND.charcoal}; letter-spacing: 0.04em;">${escapeHtml(data.trackingNumber)}</p>`,
        "champagne",
      )
    : "";

  const itemsHtml = data.items.length > 0
    ? `
      <div style="margin-top: 24px;">
        ${renderEyebrow("Co je v balíčku")}
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 8px 0 0; border-collapse: collapse;">
          ${data.items.map((item, i) => `
            <tr>
              <td style="padding: 10px 0; border-top: ${i === 0 ? "none" : `1px solid ${BRAND.borderSoft}`}; font-family: ${FONTS.sans}; font-size: 14px; color: ${BRAND.charcoal};">
                ${escapeHtml(item.name)}${item.size ? ` <span style="color: ${BRAND.charcoalMuted}; font-size: 13px;">(${escapeHtml(item.size)})</span>` : ""}
              </td>
              <td style="padding: 10px 0; border-top: ${i === 0 ? "none" : `1px solid ${BRAND.borderSoft}`}; text-align: right; font-family: ${FONTS.sans}; font-size: 14px; color: ${BRAND.charcoal}; white-space: nowrap;">
                ${formatPriceCzk(item.price)}
              </td>
            </tr>`).join("")}
          <tr>
            <td style="padding: 12px 0 0; border-top: 2px solid ${BRAND.charcoal}; font-family: ${FONTS.serif}; font-size: 17px; font-weight: 700; color: ${BRAND.charcoal};">Celkem</td>
            <td style="padding: 12px 0 0; border-top: 2px solid ${BRAND.charcoal}; text-align: right; font-family: ${FONTS.serif}; font-size: 19px; font-weight: 700; color: ${BRAND.primary};">${formatPriceCzk(data.total)}</td>
          </tr>
        </table>
      </div>`
    : "";

  const crossSellHtml = buildCrossSellProductsHtml(data.crossSellProducts);
  const firstName = data.customerName.split(" ")[0] || data.customerName;

  const content = `
    <div style="text-align: center;">
      ${renderEyebrow("Zásilka na cestě")}
      ${renderDisplayHeading(`Balíček ti letí, ${escapeHtml(firstName)}.`)}
      <p style="margin: 0 0 4px; font-family: ${FONTS.sans}; font-size: 15px; color: ${BRAND.charcoalSoft}; line-height: 1.7;">
        Objednávka <strong style="color: ${BRAND.charcoal};">${escapeHtml(data.orderNumber)}</strong> právě vyrazila.<br/>
        Pečlivě zabalená — otevři ji s klidem a kávou.
      </p>
    </div>

    <div style="margin-top: 20px;">${trackingHtml}</div>

    ${itemsHtml}

    <div style="margin: 32px 0 8px;">
      ${renderButton({ href: orderUrl, label: "Sledovat zásilku", variant: "primary" })}
    </div>

    ${crossSellHtml}`;

  return renderLayout({
    preheader: `Tvoje objednávka ${data.orderNumber} je na cestě${data.trackingNumber ? ` · ${data.trackingNumber}` : ""}.`,
    contentHtml: content,
  });
}

/**
 * Send enhanced shipping notification email with cross-sell product recommendations.
 * Used instead of generic status email when order transitions to "shipped".
 * Cross-sell products should be same category + matching sizes from live inventory.
 * Returns true on success, false on failure.
 */
export async function sendShippingNotificationEmail(data: ShippingNotificationData): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping shipping notification email");
    return false;
  }

  try {
    await mailer.sendMail({
      from: FROM_ORDERS,
      replyTo: REPLY_TO,
      to: data.customerEmail,
      subject: `Objedn\u00e1vka odesl\u00e1na \u2014 ${data.orderNumber} \u2014 Jani\u010dka Shop`,
      html: buildShippingNotificationHtml(data),
    });
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send shipping notification for ${data.orderNumber}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Newsletter welcome email
// ---------------------------------------------------------------------------

function buildNewsletterWelcomeHtml(email: string): string {
  const baseUrl = getBaseUrl();
  const unsubscribeUrl = `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(email))}`;

  const perks = [
    { icon: "&#10022;", title: "Kousky s příběhem", text: "Každý jediný svého druhu. Co si vybereš, jiná už mít nebude." },
    { icon: "&#9679;", title: "Novinky první", text: "Ranní drop ti chodí dřív, než se objeví na webu." },
    { icon: "&#10047;", title: "Udržitelná radost", text: "Kvalitní značky za zlomek ceny, s čistým svědomím." },
    { icon: "&#9733;", title: "Rychlé doručení", text: "Zásilkovna nebo Česká pošta — u tebe do pár dní." },
  ];

  const perksHtml = perks
    .map(
      (p) => `
      <tr>
        <td style="padding: 10px 0; vertical-align: top; width: 32px;">
          <div style="width: 28px; height: 28px; line-height: 28px; text-align: center; background: ${BRAND.blush}; border-radius: 50%; color: ${BRAND.primary}; font-size: 14px;">${p.icon}</div>
        </td>
        <td style="padding: 10px 0 10px 14px; vertical-align: top; font-family: ${FONTS.sans};">
          <p style="margin: 0 0 2px; font-family: ${FONTS.serif}; font-size: 16px; font-weight: 600; color: ${BRAND.charcoal};">${p.title}</p>
          <p style="margin: 0; font-size: 13px; color: ${BRAND.charcoalSoft}; line-height: 1.6;">${p.text}</p>
        </td>
      </tr>`,
    )
    .join("");

  const content = `
    <div style="text-align: center;">
      ${renderEyebrow("Vítej u mě")}
      ${renderDisplayHeading("Ráda tě tu mám.")}
      <p style="margin: 0 0 8px; font-family: ${FONTS.sans}; font-size: 15px; color: ${BRAND.charcoalSoft}; line-height: 1.7;">
        Janička tady. Děkuju, že mi chceš dát prostor ve své schránce — budu ho ctít.
      </p>
      <p style="margin: 0 0 28px; font-family: ${FONTS.serif}; font-style: italic; font-size: 17px; color: ${BRAND.primary};">
        &bdquo;Móda, která měla první život. A zaslouží si i druhý.&ldquo;
      </p>
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 8px 0 0;">
      ${perksHtml}
    </table>

    <div style="margin: 36px 0 8px;">
      ${renderButton({ href: `${baseUrl}/products?sort=newest`, label: "Prohlédnout novinky", variant: "primary" })}
    </div>
    <p style="margin: 14px 0 0; font-family: ${FONTS.sans}; font-size: 12px; color: ${BRAND.charcoalMuted}; text-align: center; line-height: 1.6;">
      Piš mi kdykoli na <a href="mailto:info@janicka.cz" style="color: ${BRAND.charcoalSoft};">info@janicka.cz</a>. Odpovídám osobně.
    </p>`;

  return renderLayout({
    preheader: "Ráda tě tu mám. Tady je, co tě u Janičky čeká.",
    contentHtml: content,
    unsubscribeUrl,
  });
}

/**
 * Send newsletter welcome email after subscription.
 * Non-blocking: logs errors instead of throwing.
 */
// ---------------------------------------------------------------------------
// Admin new order notification
// ---------------------------------------------------------------------------

interface AdminOrderNotificationData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  shippingMethod: string;
  orderId?: string;
  paid?: boolean;
}

/**
 * Resolve the admin notification target:
 * 1. ShopSettings.contactEmail (primary — task #244 spec)
 * 2. ADMIN_NOTIFICATION_EMAIL env var (fallback)
 * Also returns the notification flags so callers can skip when disabled.
 */
export async function resolveAdminNotificationConfig(): Promise<{
  email: string | null;
  notifyOnNewOrder: boolean;
  notifyOnReturn: boolean;
  notifyOnReviewFailed: boolean;
}> {
  const { getDb } = await import("@/lib/db");
  try {
    const db = await getDb();
    const settings = await db.shopSettings.findUnique({ where: { id: "singleton" } });
    const settingsEmail = settings?.contactEmail?.trim() || null;
    const fallback = process.env.ADMIN_NOTIFICATION_EMAIL ?? null;
    return {
      email: settingsEmail ?? fallback,
      notifyOnNewOrder: settings?.notifyOnNewOrder ?? true,
      notifyOnReturn: settings?.notifyOnReturn ?? true,
      notifyOnReviewFailed: settings?.notifyOnReviewFailed ?? true,
    };
  } catch {
    return {
      email: process.env.ADMIN_NOTIFICATION_EMAIL ?? null,
      notifyOnNewOrder: true,
      notifyOnReturn: true,
      notifyOnReviewFailed: true,
    };
  }
}

function buildAdminNewOrderHtml(data: AdminOrderNotificationData): string {
  const baseUrl = getBaseUrl();
  const adminUrl = data.orderId
    ? `${baseUrl}/admin/orders/${data.orderId}`
    : `${baseUrl}/admin/orders`;
  const headline = data.paid ? "Platba potvrzena" : "Nová objednávka";

  const itemsHtml = data.items
    .map((item) => `
      <tr>
        <td style="padding: 8px 0; border-top: 1px solid ${BRAND.borderSoft}; font-family: ${FONTS.serif}; font-size: 15px; color: ${BRAND.charcoal};">${escapeHtml(item.name)}</td>
        <td style="padding: 8px 0; border-top: 1px solid ${BRAND.borderSoft}; text-align: right; white-space: nowrap; font-family: ${FONTS.sans}; font-size: 14px; color: ${BRAND.charcoal};">${formatPriceCzk(item.price)}</td>
      </tr>`)
    .join("");

  const summaryRow = (label: string, value: string) => `
    <tr>
      <td style="padding: 5px 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoalSoft};">${escapeHtml(label)}</td>
      <td style="padding: 5px 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoal}; text-align: right;">${value}</td>
    </tr>`;

  const content = `
    ${renderEyebrow(headline)}
    ${renderDisplayHeading(`Objednávka ${escapeHtml(data.orderNumber)}`)}

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 8px 0 14px;">
      ${summaryRow("Zákazník", escapeHtml(data.customerName))}
      ${summaryRow("Email", `<a href="mailto:${escapeHtml(data.customerEmail)}" style="color: ${BRAND.primary}; text-decoration: none;">${escapeHtml(data.customerEmail)}</a>`)}
      ${summaryRow("Platba", escapeHtml(PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod))}
      ${summaryRow("Doprava", escapeHtml(SHIPPING_LABELS[data.shippingMethod] ?? data.shippingMethod))}
    </table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 4px 0;">
      ${itemsHtml}
    </table>

    <p style="margin: 18px 0 0; text-align: right; font-family: ${FONTS.serif}; font-size: 22px; font-weight: 600; color: ${BRAND.charcoal};">
      Celkem: <span style="color: ${BRAND.primary};">${formatPriceCzk(data.total)}</span>
    </p>

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: adminUrl, label: "Otevřít v adminu", variant: "dark" })}
    </div>`;

  return renderLayout({
    preheader: `${headline} ${data.orderNumber} — ${formatPriceCzk(data.total)}`,
    contentHtml: content,
    showTagline: false,
  });
}

/**
 * Send notification email to admin when a new order is placed.
 * Non-blocking: logs errors instead of throwing.
 */
export async function sendAdminNewOrderEmail(data: AdminOrderNotificationData): Promise<void> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping admin order notification");
    return;
  }

  const config = await resolveAdminNotificationConfig();
  if (!config.notifyOnNewOrder) {
    return;
  }
  if (!config.email) {
    logger.warn("[Email] No admin notification email configured — skipping admin order notification");
    return;
  }

  const subjectPrefix = data.paid ? "Platba potvrzena" : "Nová objednávka";
  try {
    await mailer.sendMail({
      from: FROM_SUPPORT,
      replyTo: REPLY_TO,
      to: config.email,
      subject: `${subjectPrefix} ${data.orderNumber} — ${formatPriceCzk(data.total)}`,
      html: buildAdminNewOrderHtml(data),
    });
  } catch (error) {
    logger.error(`[Email] Failed to send admin notification for ${data.orderNumber}:`, error);
  }
}

// ---------------------------------------------------------------------------
// Delivery deadline alert emails (admin notification)
// ---------------------------------------------------------------------------

export interface DeadlineAlertOrder {
  orderNumber: string;
  customerName: string;
  total: number;
  daysRemaining: number;
  expectedDeliveryDate: Date;
  status: string;
}

export async function sendAdminDeadlineAlertEmail(
  orders: DeadlineAlertOrder[],
): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) return false;

  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return false;
  if (orders.length === 0) return true;

  const overdueCount = orders.filter((o) => o.daysRemaining < 0).length;
  const urgentCount = orders.filter((o) => o.daysRemaining >= 0 && o.daysRemaining <= 5).length;

  const subject = overdueCount > 0
    ? `Termín doručení: ${overdueCount} po termínu, ${urgentCount} blízko termínu`
    : `Termín doručení: ${urgentCount} objednávek blízko termínu`;

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long" }).format(d);

  const rows = orders
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .map((o) => {
      const urgency =
        o.daysRemaining < 0
          ? `<span style="color:${BRAND.danger};font-weight:600">Po termínu (${Math.abs(o.daysRemaining)} dní)</span>`
          : o.daysRemaining === 0
            ? `<span style="color:${BRAND.warning};font-weight:600">Dnes</span>`
            : `<span style="color:${BRAND.warning}">Zbývá ${o.daysRemaining} dní</span>`;
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.borderSoft};font-family:${FONTS.sans};font-size:13px;color:${BRAND.charcoal};">${escapeHtml(o.orderNumber)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.borderSoft};font-family:${FONTS.sans};font-size:13px;color:${BRAND.charcoal};">${escapeHtml(o.customerName)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.borderSoft};font-family:${FONTS.sans};font-size:13px;color:${BRAND.charcoal};">${formatPriceCzk(o.total)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.borderSoft};font-family:${FONTS.sans};font-size:13px;color:${BRAND.charcoalSoft};">${formatDate(o.expectedDeliveryDate)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid ${BRAND.borderSoft};font-family:${FONTS.sans};font-size:13px;">${urgency}</td>
      </tr>`;
    })
    .join("");

  const baseUrl = getBaseUrl();
  const content = `
    ${renderEyebrow("Termín doručení")}
    ${renderDisplayHeading("Upozornění na termín doručení")}
    <p style="margin: 0 0 16px; font-family: ${FONTS.sans}; font-size: 14px; line-height: 1.6; color: ${BRAND.charcoalSoft};">
      Podle českého zákona musí být objednávky doručeny do 30 dní od uzavření smlouvy.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 12px 0;">
      <thead>
        <tr style="background: ${BRAND.blushSoft};">
          <th style="padding: 10px 12px; text-align: left; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${BRAND.primary}; border-bottom: 2px solid ${BRAND.border};">Objednávka</th>
          <th style="padding: 10px 12px; text-align: left; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${BRAND.primary}; border-bottom: 2px solid ${BRAND.border};">Zákazník</th>
          <th style="padding: 10px 12px; text-align: left; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${BRAND.primary}; border-bottom: 2px solid ${BRAND.border};">Celkem</th>
          <th style="padding: 10px 12px; text-align: left; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${BRAND.primary}; border-bottom: 2px solid ${BRAND.border};">Termín</th>
          <th style="padding: 10px 12px; text-align: left; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${BRAND.primary}; border-bottom: 2px solid ${BRAND.border};">Stav</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: `${baseUrl}/admin/orders`, label: "Otevřít admin objednávek", variant: "dark" })}
    </div>`;

  const html = renderLayout({
    preheader: subject,
    contentHtml: content,
    showTagline: false,
  });

  try {
    await mailer.sendMail({
      from: FROM_SUPPORT,
      replyTo: REPLY_TO,
      to: adminEmail,
      subject,
      html,
    });
    return true;
  } catch (error) {
    logger.error("[Email] Failed to send deadline alert:", error);
    return false;
  }
}

/**
 * Send a verification email to the NEW address after an email-change request.
 * Clicking the link completes the change.
 */
export async function sendEmailChangeVerifyEmail(data: {
  newEmail: string;
  firstName: string;
  verifyUrl: string;
}): Promise<void> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping email-change verify");
    return;
  }
  const firstName = (data.firstName || "").trim();
  const safeUrl = data.verifyUrl;
  const content = `
    ${renderEyebrow("Zabezpečení účtu")}
    ${renderDisplayHeading(firstName ? `Potvrď změnu, ${escapeHtml(firstName)}.` : "Potvrď změnu emailu.")}
    <p style="margin: 0 0 20px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Požádala jsi o změnu přihlašovacího emailu na svém účtu Janička Shop. Pro dokončení klikni na tlačítko níže. Odkaz je platný <strong style="color: ${BRAND.charcoal};">jednu hodinu</strong>.
    </p>

    <div style="margin: 28px 0 8px;">
      ${renderButton({ href: safeUrl, label: "Potvrdit změnu emailu", variant: "primary" })}
    </div>

    ${renderInfoCard(
      `<p style="margin: 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoalSoft}; line-height: 1.6;"><strong style="color: ${BRAND.charcoal};">Nežádala jsi?</strong> Tenhle email ignoruj. Tvůj účet zůstane beze změny a přihlašovací údaje platné dál.</p>`,
      "blush",
    )}

    <p style="margin: 20px 0 0; font-family: ${FONTS.sans}; font-size: 12px; color: ${BRAND.charcoalMuted}; line-height: 1.6;">
      Odkaz nefunguje? Zkopíruj si ho do prohlížeče:<br/>
      <span style="word-break: break-all; color: ${BRAND.charcoalSoft};">${escapeHtml(safeUrl)}</span>
    </p>`;
  const html = renderLayout({
    preheader: "Potvrď změnu přihlašovacího emailu u Janičky.",
    contentHtml: content,
  });

  try {
    await mailer.sendMail({
      from: FROM_INFO,
      replyTo: REPLY_TO,
      to: data.newEmail,
      subject: "Potvrď změnu emailu — Janička Shop",
      html,
    });
  } catch (error) {
    logger.error(`[Email] Failed to send email-change verify to ${data.newEmail}:`, error);
  }
}

/**
 * Notify the OLD email address after an email change so the customer can
 * catch unauthorized changes. Sent AFTER the swap has succeeded.
 */
export async function sendEmailChangeNoticeEmail(data: {
  oldEmail: string;
  newEmail: string;
  firstName: string;
}): Promise<void> {
  const mailer = getMailer();
  if (!mailer) return;
  const firstName = (data.firstName || "").trim();
  const safeNew = escapeHtml(data.newEmail);
  const content = `
    ${renderEyebrow("Změna účtu")}
    ${renderDisplayHeading(firstName ? `Tvůj email jsme změnili, ${escapeHtml(firstName)}.` : "Email na účtu byl změněn.")}
    <p style="margin: 0 0 16px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Přihlašovací email k tvému účtu Janička Shop byl právě změněn na:
    </p>
    <p style="margin: 0 0 24px; font-family: ${FONTS.mono}; font-size: 16px; font-weight: 600; color: ${BRAND.charcoal}; padding: 12px 16px; background: ${BRAND.blushSoft}; border-radius: 8px; word-break: break-all;">
      ${safeNew}
    </p>
    <p style="margin: 0 0 16px; font-family: ${FONTS.sans}; font-size: 14px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Pokud jsi to byla ty, nemusíš dělat nic.
    </p>
    ${renderInfoCard(
      `<p style="margin: 0; font-family: ${FONTS.sans}; font-size: 14px; color: ${BRAND.charcoal}; line-height: 1.6;"><strong style="color: ${BRAND.danger};">Nebyla jsi to ty?</strong> Ozvi se mi okamžitě na <a href="mailto:info@janicka.cz" style="color: ${BRAND.danger}; font-weight: 600;">info@janicka.cz</a>. Změnu vrátím a účet zabezpečím.</p>`,
      "warning",
    )}`;
  const html = renderLayout({
    preheader: `Přihlašovací email tvého účtu byl změněn na ${data.newEmail}.`,
    contentHtml: content,
  });

  try {
    await mailer.sendMail({
      from: FROM_INFO,
      replyTo: REPLY_TO,
      to: data.oldEmail,
      subject: "Email tvého účtu byl změněn — Janička Shop",
      html,
    });
  } catch (error) {
    logger.error(`[Email] Failed to send email-change notice to ${data.oldEmail}:`, error);
  }
}

/** Confirm to the customer that GDPR deletion has completed. */
export async function sendAccountDeletedEmail(data: {
  email: string;
  firstName: string;
}): Promise<void> {
  const mailer = getMailer();
  if (!mailer) return;
  const firstName = (data.firstName || "").trim();
  const content = `
    ${renderEyebrow("Účet smazán")}
    ${renderDisplayHeading(firstName ? `Mějsce si, ${escapeHtml(firstName)}.` : "Tvůj účet byl smazán.")}
    <p style="margin: 0 0 14px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Tvoje osobní údaje jsem právě anonymizovala. Historii objednávek uchovávám 10 let podle zákona o účetnictví &mdash; ale už bez tvých osobních údajů.
    </p>
    <p style="margin: 0 0 24px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Moc děkuju za čas, který jsi u mě strávila. Kdybys někdy chtěla zpátky, stačí si založit nový účet.
    </p>
    <p style="margin: 24px 0 0; font-family: ${FONTS.serif}; font-style: italic; font-size: 17px; color: ${BRAND.primary}; text-align: center;">
      &mdash; Janička &mdash;
    </p>`;
  const html = renderLayout({
    preheader: "Tvůj účet byl smazán a údaje anonymizovány.",
    contentHtml: content,
  });

  try {
    await mailer.sendMail({
      from: FROM_INFO,
      replyTo: REPLY_TO,
      to: data.email,
      subject: "Tvůj účet byl smazán — Janička Shop",
      html,
    });
  } catch (error) {
    logger.error(`[Email] Failed to send account-deleted email to ${data.email}:`, error);
  }
}

export async function sendNewsletterWelcomeEmail(email: string): Promise<void> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping newsletter welcome email");
    return;
  }

  try {
    await mailer.sendMail({
      from: FROM_NEWSLETTER,
      replyTo: REPLY_TO,
      to: email,
      subject: "Vítej v Janičce! — Janička Shop",
      html: buildNewsletterWelcomeHtml(email),
    });
  } catch (error) {
    logger.error(`[Email] Failed to send newsletter welcome email to ${email}:`, error);
  }
}

// ---------------------------------------------------------------------------
// Abandoned cart recovery emails (3-email sequence)
// ---------------------------------------------------------------------------

interface AbandonedCartItem {
  productId: string;
  name: string;
  price: number;
  image?: string;
  slug?: string;
  size?: string;
  color?: string;
}

interface AbandonedCartEmailData {
  email: string;
  customerName?: string | null;
  items: AbandonedCartItem[];
  cartTotal: number;
  /** AbandonedCart.id — used as unsubscribe token in email footer. */
  cartId: string;
}

function cartItemsToRows(items: AbandonedCartItem[]) {
  const baseUrl = getBaseUrl();
  return items.map((item) => {
    const meta = [item.size, item.color].filter(Boolean).join(" · ");
    return {
      name: item.name,
      url: item.slug ? `${baseUrl}/products/${item.slug}` : baseUrl,
      image: item.image ?? null,
      meta: meta || null,
      price: item.price,
    };
  });
}

function abandonedCartUnsubscribeUrl(cartId: string): string {
  return `${getBaseUrl()}/api/unsubscribe/abandoned-cart/${encodeURIComponent(cartId)}`;
}

function buildAbandonedCartEmailWrapper(
  preheader: string,
  contentHtml: string,
  ctaText: string,
  ctaUrl: string,
  cartId: string,
): string {
  const finalContent = `
    ${contentHtml}
    <div style="margin: 32px 0 4px;">
      ${renderButton({ href: ctaUrl, label: ctaText, variant: "primary" })}
    </div>`;
  return renderLayout({
    preheader,
    contentHtml: finalContent,
    unsubscribeUrl: abandonedCartUnsubscribeUrl(cartId),
    unsubscribeText: "Tenhle email ti chodí, protože jsi v košíku nechala kousek.",
  });
}

/**
 * Email 1: Sent 30-60 minutes after abandonment.
 * "Zapomněla jsi na svůj kousek?" — gentle reminder with product images.
 */
function buildAbandonedCartEmail1(data: AbandonedCartEmailData): string {
  const baseUrl = getBaseUrl();
  const firstName = data.customerName?.trim().split(" ")[0];

  const content = `
    ${renderEyebrow("Tvůj košík")}
    ${renderDisplayHeading(firstName ? `${escapeHtml(firstName)}, nezapomněla jsi?` : "Nezapomněla jsi na svůj kousek?")}
    <p style="margin: 0 0 18px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Máš v košíku pár pečlivě vybraných kousků. Každý z nich je u mě jen jednou &mdash; jakmile si ho někdo odnese, je pryč.
    </p>

    ${renderInfoCard(
      `<p style="margin: 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoal}; line-height: 1.6;"><strong style="color: ${BRAND.primary};">Unikát.</strong> Každý kus je jediný svého druhu &mdash; rezervaci košíku nemůžu garantovat.</p>`,
      "champagne",
    )}

    ${renderProductRowList(cartItemsToRows(data.items))}

    <p style="margin: 18px 0 0; text-align: right; font-family: ${FONTS.serif}; font-size: 19px; font-weight: 600; color: ${BRAND.charcoal};">
      Celkem: <span style="color: ${BRAND.primary};">${formatPriceCzk(data.cartTotal)}</span>
    </p>`;

  return buildAbandonedCartEmailWrapper(
    "Tvůj košík u Janičky na tebe stále čeká.",
    content,
    "Dokončit objednávku",
    `${baseUrl}/cart?restore=${encodeURIComponent(data.cartId)}`,
    data.cartId,
  );
}

/**
 * Email 2: Sent 12-24 hours after abandonment.
 * "Stále na tebe čeká..." — follow-up, mentions if item was sold.
 * @param soldProductIds - productIds of items that have been sold (matched by ID, not name).
 */
function buildAbandonedCartEmail2(data: AbandonedCartEmailData, soldProductIds: string[]): string {
  const baseUrl = getBaseUrl();
  const firstName = data.customerName?.trim().split(" ")[0];
  const soldIdSet = new Set(soldProductIds);
  const soldItems = data.items.filter((i) => soldIdSet.has(i.productId));
  const availableItems = data.items.filter((i) => !soldIdSet.has(i.productId));

  const soldNotice = soldItems.length > 0
    ? renderInfoCard(
        `<p style="margin: 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoal}; line-height: 1.6;"><strong style="color: ${BRAND.danger};">Bohužel.</strong> ${soldItems.map((i) => `<em style="color: ${BRAND.charcoal};">${escapeHtml(i.name)}</em>`).join(", ")} už ${soldItems.length === 1 ? "našel" : "našly"} novou majitelku.${availableItems.length > 0 ? " Ostatní ale na tebe pořád čekají." : ""}</p>`,
        "warning",
      )
    : "";

  const itemsHtml = availableItems.length > 0
    ? renderProductRowList(cartItemsToRows(availableItems))
    : "";

  const ctaText = availableItems.length > 0 ? "Dokončit objednávku" : "Prohlédnout podobné kousky";
  const ctaUrl = availableItems.length > 0
    ? `${baseUrl}/cart?restore=${encodeURIComponent(data.cartId)}`
    : `${baseUrl}/products?sort=newest`;

  const totalLine = availableItems.length > 0
    ? `<p style="margin: 18px 0 0; text-align: right; font-family: ${FONTS.serif}; font-size: 19px; font-weight: 600; color: ${BRAND.charcoal};">Celkem: <span style="color: ${BRAND.primary};">${formatPriceCzk(availableItems.reduce((sum, i) => sum + i.price, 0))}</span></p>`
    : "";

  const content = `
    ${renderEyebrow("Druhá připomínka")}
    ${renderDisplayHeading(firstName ? `${escapeHtml(firstName)}, ještě tu jsou.` : "Tvůj košík tu pořád je.")}
    <p style="margin: 0 0 18px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      U second handu nikdy nevíš, jak dlouho to vydrží &mdash; každý kus existuje pouze jednou. Pokud ti padly do oka, neváhej.
    </p>

    ${soldNotice}
    ${itemsHtml}
    ${totalLine}`;

  return buildAbandonedCartEmailWrapper(
    "U Janičky tě pořád čeká pár kousků z košíku.",
    content,
    ctaText,
    ctaUrl,
    data.cartId,
  );
}

/**
 * Email 3: Sent 48-72 hours after abandonment.
 * "Poslední upozornění" — final reminder with urgency.
 * @param soldProductIds - productIds of items confirmed sold (matched by ID, not name).
 */
function buildAbandonedCartEmail3(data: AbandonedCartEmailData, soldProductIds: string[]): string {
  const baseUrl = getBaseUrl();
  const firstName = data.customerName?.trim().split(" ")[0];
  const soldIdSet = new Set(soldProductIds);
  const soldItems = data.items.filter((i) => soldIdSet.has(i.productId));
  const availableItems = data.items.filter((i) => !soldIdSet.has(i.productId));

  const soldNotice = soldItems.length > 0
    ? renderInfoCard(
        `<p style="margin: 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoal}; line-height: 1.6;">${soldItems.map((i) => `<em style="color: ${BRAND.charcoal};">${escapeHtml(i.name)}</em>`).join(", ")} &mdash; ${soldItems.length === 1 ? "bohužel prodáno" : "bohužel prodány"}. <a href="${baseUrl}/products?sort=newest" style="color: ${BRAND.primary}; text-decoration: underline; font-weight: 600;">Podobné kousky &rarr;</a></p>`,
        "warning",
      )
    : "";

  const itemsHtml = availableItems.length > 0
    ? renderProductRowList(cartItemsToRows(availableItems))
    : "";

  const ctaText = availableItems.length > 0 ? "Naposledy — dokončit objednávku" : "Prohlédnout novinky";
  const ctaUrl = availableItems.length > 0
    ? `${baseUrl}/cart?restore=${encodeURIComponent(data.cartId)}`
    : `${baseUrl}/products?sort=newest`;

  const totalLine = availableItems.length > 0
    ? `<p style="margin: 18px 0 0; text-align: right; font-family: ${FONTS.serif}; font-size: 19px; font-weight: 600; color: ${BRAND.charcoal};">Celkem: <span style="color: ${BRAND.primary};">${formatPriceCzk(availableItems.reduce((sum, i) => sum + i.price, 0))}</span></p>`
    : "";

  const content = `
    ${renderEyebrow("Poslední připomínka")}
    ${renderDisplayHeading(firstName ? `${escapeHtml(firstName)}, naposledy.` : "Naposledy.")}
    <p style="margin: 0 0 18px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Tohle je poslední upozornění &mdash; pak tvůj košík tiše zmizí. ${availableItems.length > 0 ? "Kousky jsou pořád na tebe, ale u second handu nikdy nevíš." : ""}
    </p>

    ${soldNotice}
    ${itemsHtml}
    ${totalLine}`;

  return buildAbandonedCartEmailWrapper(
    "Poslední připomínka — tvůj košík brzy vyprší.",
    content,
    ctaText,
    ctaUrl,
    data.cartId,
  );
}

/**
 * Send abandoned cart recovery email (stage 1, 2, or 3).
 * @param soldProductIds - productIds of items confirmed sold since cart capture.
 *   Using IDs (not names) prevents false-positive matches when multiple items
 *   share the same display name.
 * Returns true if email was sent, false if skipped.
 */
export async function sendAbandonedCartEmail(
  stage: 1 | 2 | 3,
  data: AbandonedCartEmailData,
  soldProductIds?: string[]
): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping abandoned cart email");
    return false;
  }

  const subjects: Record<number, string> = {
    1: "Zapomněla jsi na svůj košík — Janička Shop",
    2: "Tvůj košík stále čeká — Janička Shop",
    3: "Poslední upozornění — Janička Shop",
  };

  let html: string;
  switch (stage) {
    case 1:
      html = buildAbandonedCartEmail1(data);
      break;
    case 2:
      html = buildAbandonedCartEmail2(data, soldProductIds ?? []);
      break;
    case 3:
      html = buildAbandonedCartEmail3(data, soldProductIds ?? []);
      break;
  }

  try {
    await mailer.sendMail({
      from: FROM_INFO,
      replyTo: REPLY_TO,
      to: data.email,
      subject: subjects[stage],
      html,
    });
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send abandoned cart email #${stage} to ${data.email}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Review request email (sent 7 days after shipping)
// ---------------------------------------------------------------------------

interface ReviewRequestEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  accessToken: string;
  items: { name: string; size?: string | null; color?: string | null }[];
}

function buildReviewRequestHtml(data: ReviewRequestEmailData): string {
  const baseUrl = getBaseUrl();
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;
  const shopUrl = `${baseUrl}/products?sort=newest`;
  const firstName = data.customerName?.trim().split(" ")[0] || data.customerName;

  const itemsList = data.items
    .map((item) => {
      const detail = [item.size, item.color].filter(Boolean).join(" · ");
      return `<li style="padding: 6px 0; font-family: ${FONTS.sans}; font-size: 14px; color: ${BRAND.charcoal}; line-height: 1.5;"><span style="font-family: ${FONTS.serif}; font-weight: 600;">${escapeHtml(item.name)}</span>${detail ? `<span style="color: ${BRAND.charcoalSoft}; font-size: 13px;"> &middot; ${escapeHtml(detail)}</span>` : ""}</li>`;
    })
    .join("");

  const content = `
    ${renderEyebrow(`Objednávka ${data.orderNumber}`)}
    ${renderDisplayHeading(firstName ? `${escapeHtml(firstName)}, jak ti padly?` : "Jak ti padly?")}
    <p style="margin: 0 0 16px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Je to týden, co máš svoji objednávku doma. Hrozně mě zajímá, jestli ti všechno padne přesně tak, jak jsi doufala &mdash; a kdyby něco nesedělo, ráda to s tebou vyřeším.
    </p>

    ${renderInfoCard(
      `<div style="font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoalSoft};">
        <p style="margin: 0 0 8px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: ${BRAND.primary};">Tvoje kousky</p>
        <ul style="margin: 0; padding: 0 0 0 18px;">${itemsList}</ul>
      </div>`,
      "blush",
    )}

    <p style="margin: 18px 0 24px; font-family: ${FONTS.sans}; font-size: 14px; line-height: 1.7; color: ${BRAND.charcoalSoft}; text-align: center;">
      Tvoje hodnocení mi pomůže vybírat ještě lépe &mdash; a další holky díky tobě uvidí, jak to u mě chodí doopravdy.
    </p>

    <div style="margin: 20px 0 8px;">
      ${renderButton({ href: orderUrl, label: "Napsat hodnocení", variant: "primary" })}
    </div>

    <p style="margin: 20px 0 0; text-align: center; font-family: ${FONTS.sans}; font-size: 13px;">
      <a href="${shopUrl}" style="color: ${BRAND.charcoalSoft}; text-decoration: underline;">Nebo se podívej na novinky &rarr;</a>
    </p>`;

  return renderLayout({
    preheader: `Jak ti padla objednávka ${data.orderNumber}? Tvůj názor mi pomáhá.`,
    contentHtml: content,
    footerNote: "Tenhle email ti chodí, protože jsi u mě nakoupila.",
  });
}

/**
 * Send review request email 7 days after shipping.
 * Non-blocking: logs errors instead of throwing.
 */
export async function sendReviewRequestEmail(data: ReviewRequestEmailData): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping review request email");
    return false;
  }

  try {
    await mailer.sendMail({
      from: FROM_SUPPORT,
      replyTo: REPLY_TO,
      to: data.customerEmail,
      subject: `Jak jsi spokojená? — ${data.orderNumber} — Janička Shop`,
      html: buildReviewRequestHtml(data),
    });
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send review request email for ${data.orderNumber}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Delivery check-in email (ship+4 days — "Dorazilo vše v pořádku?")
// ---------------------------------------------------------------------------

interface DeliveryCheckEmailData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  accessToken: string;
  items: { name: string; size?: string | null; color?: string | null }[];
}

function buildDeliveryCheckHtml(data: DeliveryCheckEmailData): string {
  const baseUrl = getBaseUrl();
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;
  const returnsUrl = `${baseUrl}/returns`;
  const firstName = data.customerName?.trim().split(" ")[0] || data.customerName;

  const itemsList = data.items
    .map((item) => {
      const detail = [item.size, item.color].filter(Boolean).join(" · ");
      return `<li style="padding: 6px 0; font-family: ${FONTS.sans}; font-size: 14px; color: ${BRAND.charcoal}; line-height: 1.5;"><span style="font-family: ${FONTS.serif}; font-weight: 600;">${escapeHtml(item.name)}</span>${detail ? `<span style="color: ${BRAND.charcoalSoft}; font-size: 13px;"> &middot; ${escapeHtml(detail)}</span>` : ""}</li>`;
    })
    .join("");

  const content = `
    ${renderEyebrow(`Objednávka ${data.orderNumber}`)}
    ${renderDisplayHeading(firstName ? `${escapeHtml(firstName)}, dorazilo to v pořádku?` : "Dorazilo to v pořádku?")}
    <p style="margin: 0 0 16px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Tvůj balíček by už měl být u tebe. Chci se jen ujistit, že je všechno tak, jak má být &mdash; balení, kousky, velikosti.
    </p>

    ${renderInfoCard(
      `<div style="font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoalSoft};">
        <p style="margin: 0 0 8px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: ${BRAND.primary};">V balíčku</p>
        <ul style="margin: 0; padding: 0 0 0 18px;">${itemsList}</ul>
      </div>`,
      "blush",
    )}

    <p style="margin: 18px 0 24px; font-family: ${FONTS.sans}; font-size: 14px; line-height: 1.7; color: ${BRAND.charcoalSoft}; text-align: center;">
      Kdyby něco nesedělo &mdash; třeba velikost, vada, nebo se balíček vůbec nedostavil &mdash; dej mi vědět. Vyřeším to s tebou hned.
    </p>

    <div style="margin: 20px 0 8px;">
      ${renderButton({ href: returnsUrl, label: "Mám problém s objednávkou", variant: "primary" })}
    </div>

    <p style="margin: 20px 0 0; text-align: center; font-family: ${FONTS.sans}; font-size: 13px;">
      <a href="${orderUrl}" style="color: ${BRAND.charcoalSoft}; text-decoration: underline;">Detail objednávky &rarr;</a>
    </p>`;

  return renderLayout({
    preheader: `Tvůj balíček by měl být u tebe — všechno v pořádku?`,
    contentHtml: content,
    footerNote: "Tenhle email ti chodí, protože jsi u mě nakoupila.",
  });
}

/**
 * Send delivery check-in email ~4 days after shipping.
 * Pure care email — no marketing, no cross-sell.
 * Catches delivery issues early, reduces chargebacks, builds trust.
 * Non-blocking: logs errors instead of throwing.
 */
export async function sendDeliveryCheckEmail(data: DeliveryCheckEmailData): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping delivery check email");
    return false;
  }

  try {
    await mailer.sendMail({
      from: FROM_SUPPORT,
      replyTo: REPLY_TO,
      to: data.customerEmail,
      subject: `Dorazilo vše v pořádku? — ${data.orderNumber} — Janička Shop`,
      html: buildDeliveryCheckHtml(data),
    });
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send delivery check email for ${data.orderNumber}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// New arrival notification emails (personalized by subscriber preferences)
// ---------------------------------------------------------------------------

interface NewArrivalProduct {
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  brand: string | null;
  condition: string;
  image: string | null;
  sizes: string[];
}

export interface NewArrivalEmailData {
  email: string;
  firstName: string | null;
  products: NewArrivalProduct[];
}

const CONDITION_LABELS_EMAIL: Record<string, string> = {
  new_with_tags: "Nové s visačkou",
  new_without_tags: "Nové bez visačky",
  excellent: "Výborný stav",
  good: "Dobrý stav",
  visible_wear: "Viditelné opotřebení",
};

function newArrivalsToGridItems(products: NewArrivalProduct[]) {
  const baseUrl = getBaseUrl();
  return products.map((p) => {
    const conditionLabel = CONDITION_LABELS_EMAIL[p.condition] ?? p.condition;
    const sizes = p.sizes.length > 0 ? `Vel. ${p.sizes.join(", ")}` : null;
    const meta = [conditionLabel, sizes].filter(Boolean).join(" · ");
    return {
      name: p.name,
      brand: p.brand,
      meta,
      url: `${baseUrl}/products/${p.slug}`,
      image: p.image,
      price: p.price,
      compareAt: p.compareAt,
      caption: "Unikát · 1 ks",
    };
  });
}

function buildNewArrivalHtml(data: NewArrivalEmailData): string {
  const baseUrl = getBaseUrl();
  const shopUrl = `${baseUrl}/products?sort=newest`;
  const firstName = data.firstName?.trim();
  const count = data.products.length;
  const heading = firstName
    ? `${escapeHtml(firstName)}, něco nového pro tebe.`
    : count === 1
      ? "Nový kousek, který bys mohla milovat."
      : "Nové kousky, které bys mohla milovat.";

  const content = `
    ${renderEyebrow("Novinky")}
    ${renderDisplayHeading(heading)}
    <p style="margin: 0 0 18px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Vybrala jsem ${count === 1 ? "jeden kousek" : `${count} kousků`}, ${count === 1 ? "který by se ti mohl líbit" : "které by se ti mohly líbit"}. Každý existuje jen jednou &mdash; když ti padne do oka, neváhej.
    </p>

    ${renderProductGrid(newArrivalsToGridItems(data.products), 2)}

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: shopUrl, label: "Prohlédnout všechny novinky", variant: "outline" })}
    </div>`;

  return renderLayout({
    preheader: count === 1
      ? "Mám pro tebe jeden nový kousek."
      : `Mám pro tebe ${count} nových kousků.`,
    contentHtml: content,
    unsubscribeUrl: `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(data.email))}`,
    unsubscribeText: "Tenhle email ti chodí, protože odebíráš novinky z Janičky.",
  });
}

/**
 * Send new arrival notification email to a subscriber.
 * Returns true on success, false on failure.
 */
export async function sendNewArrivalEmail(data: NewArrivalEmailData): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping new arrival email");
    return false;
  }

  const count = data.products.length;
  const subject = count === 1
    ? `Nový kousek pro tebe! — Janička Shop`
    : `${count} nových kousků pro tebe! — Janička Shop`;

  try {
    await mailer.sendMail({
      from: FROM_NEWSLETTER,
      replyTo: REPLY_TO,
      to: data.email,
      subject,
      html: buildNewArrivalHtml(data),
    });
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send new arrival email to ${data.email}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Browse abandonment email (single email, €3.22 RPR benchmark)
// ---------------------------------------------------------------------------

export interface BrowseAbandonmentEmailData {
  email: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  productPrice: number;
  productBrand: string | null;
  productSize: string | null;
}

function buildBrowseAbandonmentHtml(data: BrowseAbandonmentEmailData): string {
  const baseUrl = getBaseUrl();
  const productUrl = `${baseUrl}/products/${encodeURIComponent(data.productSlug)}`;
  const shopUrl = `${baseUrl}/products?sort=newest`;

  const brandLine = data.productBrand ? ` od ${escapeHtml(data.productBrand)}` : "";
  const sizeLine = data.productSize ? ` (vel. ${escapeHtml(data.productSize)})` : "";

  const imageBlock = data.productImage
    ? `<a href="${productUrl}" style="display: block; text-decoration: none;">
        <img src="${escapeHtml(data.productImage)}" alt="${escapeHtml(data.productName)}" style="width: 100%; max-width: 440px; height: auto; border-radius: 14px; border: 1px solid ${BRAND.borderSoft}; display: block; margin: 0 auto;" />
      </a>`
    : "";

  const content = `
    ${renderEyebrow("Pořád čeká — pro jednu")}
    ${renderDisplayHeading("Padla ti do oka, ale neví, jestli si pro ni přijdeš.")}
    <p style="margin: 0 0 18px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Prohlížela jsi si <strong style="color: ${BRAND.charcoal}; font-family: ${FONTS.serif}; font-weight: 600;">${escapeHtml(data.productName)}</strong>${brandLine}${sizeLine}. Tenhle kousek je u mě jen jednou &mdash; jak ho někdo koupí, je pryč.
    </p>

    ${imageBlock}

    <p style="margin: 22px 0 4px; text-align: center; font-family: ${FONTS.serif}; font-size: 26px; font-weight: 600; color: ${BRAND.primary};">
      ${formatPriceCzk(data.productPrice)}
    </p>
    <p style="margin: 0 0 20px; text-align: center;">
      ${renderTagPill("Unikát · 1 ks", "primary")}
    </p>

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: productUrl, label: "Vrátit se ke kousku", variant: "primary" })}
    </div>

    <p style="margin: 18px 0 0; text-align: center; font-family: ${FONTS.sans}; font-size: 13px;">
      <a href="${shopUrl}" style="color: ${BRAND.charcoalSoft}; text-decoration: underline;">Nebo se podívej na další kousky &rarr;</a>
    </p>`;

  return renderLayout({
    preheader: `${data.productName} u mě pořád čeká — ale jen na jednu z vás.`,
    contentHtml: content,
    unsubscribeUrl: `${baseUrl}/api/unsubscribe/browse-abandonment?token=${encodeURIComponent(signUnsubscribeToken(data.email))}`,
    unsubscribeText: "Tenhle email ti chodí, protože jsi si u mě prohlížela kousky.",
  });
}

/**
 * Send a browse abandonment email — single email per viewed product.
 * Authentic scarcity: each second-hand item genuinely exists only once.
 * Subject line names the specific product for maximum open rate.
 */
export async function sendBrowseAbandonmentEmail(
  data: BrowseAbandonmentEmailData,
): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping browse abandonment email");
    return false;
  }

  const brandPart = data.productBrand ? ` ${data.productBrand}` : "";
  const sizePart = data.productSize ? ` vel. ${data.productSize}` : "";
  const subject = `Ještě tam je —${brandPart} ${data.productName}${sizePart} — Janička Shop`;

  try {
    await mailer.sendMail({
      from: FROM_NEWSLETTER,
      replyTo: REPLY_TO,
      to: data.email,
      subject,
      html: buildBrowseAbandonmentHtml(data),
    });
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send browse abandonment email to ${data.email}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cross-sell follow-up email (T+14 days after purchase)
// ---------------------------------------------------------------------------

export interface CrossSellFollowUpData {
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  products: CrossSellProduct[];
}

function crossSellsToGridItems(products: CrossSellProduct[]) {
  const baseUrl = getBaseUrl();
  return products.map((p) => {
    const conditionLabel = CONDITION_LABELS_EMAIL[p.condition] ?? p.condition;
    const sizes = p.sizes.length > 0 ? `Vel. ${p.sizes.join(", ")}` : null;
    const meta = [conditionLabel, sizes].filter(Boolean).join(" · ");
    return {
      name: p.name,
      brand: p.brand,
      meta,
      url: `${baseUrl}/products/${p.slug}`,
      image: p.image,
      price: p.price,
      compareAt: p.compareAt,
    };
  });
}

function buildCrossSellFollowUpHtml(data: CrossSellFollowUpData): string {
  const baseUrl = getBaseUrl();
  const firstName = data.customerName?.trim().split(" ")[0] || data.customerName;

  const content = `
    ${renderEyebrow("Nové kousky pro tebe")}
    ${renderDisplayHeading(firstName ? `${escapeHtml(firstName)}, vybrala jsem ti něco.` : "Vybrala jsem ti pár novinek.")}
    <p style="margin: 0 0 18px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Od tvého posledního nákupu mi přibyly kousky, které ti podle stylu a velikosti můžou sednout. Každý je jen jeden &mdash; jako vždy.
    </p>

    ${renderProductGrid(crossSellsToGridItems(data.products), 2)}

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: `${baseUrl}/products?sort=newest`, label: "Prohlédnout všechny novinky", variant: "outline" })}
    </div>`;

  return renderLayout({
    preheader: "Mám pro tebe pár nových kousků ve tvém stylu.",
    contentHtml: content,
    unsubscribeUrl: `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(data.customerEmail))}`,
    unsubscribeText: "Tenhle email ti chodí, protože jsi u mě nakoupila.",
  });
}

/**
 * Send cross-sell follow-up email 14 days after purchase.
 * Shows 3 live products from same category + size as purchased items.
 * Subject leads with discovery framing — no discount language.
 */
export async function sendCrossSellFollowUpEmail(
  data: CrossSellFollowUpData,
): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping cross-sell follow-up email");
    return false;
  }

  try {
    await mailer.sendMail({
      from: FROM_NEWSLETTER,
      replyTo: REPLY_TO,
      to: data.customerEmail,
      subject: "Nové kousky ve tvém stylu — Janička Shop",
      html: buildCrossSellFollowUpHtml(data),
    });
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send cross-sell follow-up to ${data.customerEmail}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Win-back email (30+ days since last order, no recent purchase)
// ---------------------------------------------------------------------------

export interface WinBackEmailData {
  customerName: string;
  customerEmail: string;
  products: CrossSellProduct[];
}

function buildWinBackHtml(data: WinBackEmailData): string {
  const baseUrl = getBaseUrl();
  const firstName = data.customerName?.trim().split(" ")[0] || data.customerName;

  const content = `
    ${renderEyebrow("Dlouho jsme se neviděly")}
    ${renderDisplayHeading(firstName ? `${escapeHtml(firstName)}, chybíš mi tu.` : "Chybíš mi tu.")}
    <p style="margin: 0 0 18px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Už je to chvíli, co jsi naposledy nakupovala. Zatím mi přibyla spousta nových unikátních kousků &mdash; možná je mezi nimi něco přesně pro tebe.
    </p>

    ${renderProductGrid(crossSellsToGridItems(data.products), 2)}

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: `${baseUrl}/products?sort=newest`, label: "Podívat se na novinky", variant: "primary" })}
    </div>`;

  return renderLayout({
    preheader: "Přibyly mi nové unikátní kousky — třeba je mezi nimi ten tvůj.",
    contentHtml: content,
    unsubscribeUrl: `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(data.customerEmail))}`,
    unsubscribeText: "Tenhle email ti chodí, protože jsi u mě dřív nakoupila.",
  });
}

/**
 * Send win-back email to customers who haven't ordered in 30+ days.
 * Shows fresh products to re-engage lapsed customers.
 */
export async function sendWinBackEmail(
  data: WinBackEmailData,
): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping win-back email");
    return false;
  }

  try {
    await mailer.sendMail({
      from: FROM_NEWSLETTER,
      replyTo: REPLY_TO,
      to: data.customerEmail,
      subject: "Nové kousky čekají — Janička Shop",
      html: buildWinBackHtml(data),
    });
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send win-back email to ${data.customerEmail}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Newsletter campaign email (admin-triggered promotional campaigns)
// ---------------------------------------------------------------------------

export interface CampaignProduct {
  name: string;
  slug: string;
  price: number;
  compareAt: number | null;
  brand: string | null;
  condition: string;
  image: string | null;
}

export interface CampaignEmailData {
  subject: string;
  previewText: string;
  heading: string;
  bodyHtml: string;
  products: CampaignProduct[];
  ctaText: string;
  ctaUrl: string;
}

function campaignsToGridItems(products: CampaignProduct[], caption?: string) {
  const baseUrl = getBaseUrl();
  return products.map((p) => {
    const conditionLabel = CONDITION_LABELS_EMAIL[p.condition] ?? p.condition;
    return {
      name: p.name,
      brand: p.brand,
      meta: conditionLabel,
      url: `${baseUrl}/products/${p.slug}`,
      image: p.image,
      price: p.price,
      compareAt: p.compareAt,
      caption: caption ?? null,
    };
  });
}

function buildCampaignHtml(data: CampaignEmailData, recipientEmail: string): string {
  const baseUrl = getBaseUrl();
  const unsubscribeUrl = `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}`;

  const productsHtml = data.products.length > 0
    ? renderProductGrid(campaignsToGridItems(data.products), 2)
    : "";

  const content = `
    ${renderEyebrow("Z Janičky")}
    ${renderDisplayHeading(data.heading)}
    <div style="font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      ${data.bodyHtml}
    </div>

    ${productsHtml}

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: data.ctaUrl, label: data.ctaText, variant: "primary" })}
    </div>`;

  return renderLayout({
    preheader: data.previewText,
    contentHtml: content,
    unsubscribeUrl,
    unsubscribeText: "Tenhle email ti chodí, protože odebíráš novinky z Janičky.",
  });
}

/**
 * Send a single campaign email to one recipient.
 * Returns true on success, false on failure (non-throwing for batch use).
 */
export async function sendCampaignEmail(
  data: CampaignEmailData,
  recipientEmail: string,
): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping campaign email");
    return false;
  }

  try {
    await mailer.sendMail({
      from: FROM_NEWSLETTER,
      replyTo: REPLY_TO,
      to: recipientEmail,
      subject: data.subject,
      html: buildCampaignHtml(data, recipientEmail),
    });
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send campaign email to ${recipientEmail}:`, error);
    return false;
  }
}

export function renderCampaignEmailPreview(
  data: CampaignEmailData,
  recipientEmail: string,
): string {
  return buildCampaignHtml(data, recipientEmail);
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Den matek 2026 — 3-email campaign (Task #103)
// ---------------------------------------------------------------------------

export type MothersDayEmailNumber = 1 | 2 | 3;
export type MothersDaySegment = "warm" | "cold";

const MOTHERS_DAY_SUBJECTS: Record<MothersDayEmailNumber, Record<MothersDaySegment, string>> = {
  1: {
    warm: "Najdi mámě kousek, který nemá nikdo jiný",
    cold: "Daruj originál místo masové výroby — každý kousek unikát",
  },
  2: {
    warm: "Mámě zbývá pár dní — co ji opravdu potěší?",
    cold: "Mámě zbývá pár dní — co ji opravdu potěší?",
  },
  3: {
    warm: "Poslední šance — odešlu do 3 dnů",
    cold: "Poslední šance — odešlu do 3 dnů",
  },
};

const MOTHERS_DAY_PREVIEWS: Record<MothersDayEmailNumber, string> = {
  1: "U Janičky víš, co kupuješ.",
  2: "Každý kousek je unikát — kdokoliv ho může koupit dřív.",
  3: "Doprava zdarma nad 1 500 Kč. Stihni to pro mámu.",
};

function buildMothersDayEmailShell(
  previewText: string,
  recipientEmail: string,
  innerHtml: string,
): string {
  const baseUrl = getBaseUrl();
  return renderLayout({
    preheader: previewText,
    contentHtml: innerHtml,
    footerNote: "<em>Pro mámu, která má svůj styl. Každý kousek u mě je jediný svého druhu.</em>",
    unsubscribeUrl: `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}`,
    unsubscribeText: "Tenhle email ti chodí, protože odebíráš novinky z Janičky.",
  });
}

// --- Email 1: Warmup (May 1) ---

function buildMothersDayEmail1Html(
  products: CampaignProduct[],
  recipientEmail: string,
): string {
  const baseUrl = getBaseUrl();
  const ctaUrl = `${baseUrl}/products?sort=newest`;

  const productsHtml = products.length > 0
    ? renderProductGrid(campaignsToGridItems(products, "Unikát · 1 ks"), 2)
    : "";

  const personaCell = (bg: string, label: string, copy: string) => `
    <td valign="top" align="center" style="width: 33.33%; padding: 8px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td align="center" style="background: ${bg}; border-radius: 14px; padding: 22px 12px;">
            <p style="margin: 0; font-family: ${FONTS.serif}; font-size: 17px; font-weight: 600; color: ${BRAND.charcoal};">${label}</p>
            <p style="margin: 8px 0 0; font-family: ${FONTS.sans}; font-size: 12px; line-height: 1.5; color: ${BRAND.charcoalSoft};">${copy}</p>
          </td>
        </tr>
      </table>
    </td>`;

  const personaGridHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px -8px 4px;">
      <tr>
        ${personaCell(BRAND.blushSoft, "Minimalistka", "Čisté linie, nadčasové kousky")}
        ${personaCell(BRAND.champagneSoft, "Klasička", "Elegance a ověřená kvalita")}
        ${personaCell(BRAND.successSoft, "Boho", "Volnost, barvy, originalita")}
      </tr>
    </table>
    <p style="margin: 4px 0 0; text-align: center; font-family: ${FONTS.serif}; font-style: italic; font-size: 14px; color: ${BRAND.charcoalSoft};">Jaká je tvoje máma? Najdi jí kousek na míru.</p>`;

  const innerHtml = `
    ${renderEyebrow("Den matek · 10. května")}
    ${renderDisplayHeading("Daruj mámě kousek, který nemá nikdo jiný.")}
    <p style="margin: 0 0 16px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Místo masově vyráběných dárků jí dej něco, co má příběh &mdash; originální kousek, pečlivě vybraný a zkontrolovaný.
    </p>
    <p style="margin: 0 0 8px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Každý kus u mě existuje jen jednou. Žádné kopie, žádné série. Až ho máma rozbalí, bude vědět, že jsi vybírala opravdu jen pro ni.
    </p>

    ${personaGridHtml}
    ${productsHtml}

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: ctaUrl, label: "Prohlédnout dárky pro mámu", variant: "primary" })}
    </div>`;

  return buildMothersDayEmailShell(
    MOTHERS_DAY_PREVIEWS[1],
    recipientEmail,
    innerHtml,
  );
}

// --- Email 2: Push (May 7) ---

function buildMothersDayEmail2Html(
  products: CampaignProduct[],
  recipientEmail: string,
): string {
  const baseUrl = getBaseUrl();
  const ctaUrl = `${baseUrl}/products?sort=newest`;

  const productsHtml = products.length > 0
    ? renderProductGrid(campaignsToGridItems(products, "Unikát · 1 ks"), 2)
    : "";

  const innerHtml = `
    ${renderEyebrow("Mámě zbývají 3 dny")}
    ${renderDisplayHeading("Kytka zvadne. Krásný kousek zůstane.")}
    <p style="margin: 0 0 16px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Den matek je už za <strong style="color: ${BRAND.charcoal};">3 dny</strong>. Bonboniéra se sní za večer &mdash; ale kousek oblečení ji potěší pokaždé, když si ho oblékne a vzpomene na tebe.
    </p>

    ${renderInfoCard(
      `<p style="margin: 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoal}; line-height: 1.6;"><strong style="color: ${BRAND.primary};">Unikát.</strong> Každý kousek u mě existuje jen jednou &mdash; kdokoliv ho může koupit dřív.</p>`,
      "champagne",
    )}

    ${productsHtml}

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: ctaUrl, label: "Vybrat dárek pro mámu", variant: "primary" })}
    </div>

    <p style="margin: 22px 0 0; font-family: ${FONTS.serif}; font-style: italic; font-size: 14px; color: ${BRAND.charcoalSoft}; text-align: center;">
      Tip: Nevíš velikost? Dárková poukázka je vždy jistota.
    </p>`;

  return buildMothersDayEmailShell(
    MOTHERS_DAY_PREVIEWS[2],
    recipientEmail,
    innerHtml,
  );
}

// --- Email 3: Urgency (May 9) ---

function buildMothersDayEmail3Html(
  products: CampaignProduct[],
  recipientEmail: string,
): string {
  const baseUrl = getBaseUrl();
  const ctaUrl = `${baseUrl}/products?sort=newest`;

  const productsHtml = products.length > 0
    ? renderProductGrid(campaignsToGridItems(products.slice(0, 3), "Unikát"), 3)
    : "";

  const innerHtml = `
    ${renderEyebrow("Den matek · zítra")}
    ${renderDisplayHeading("Poslední den, kdy to ještě stihnem.")}
    <p style="margin: 0 0 16px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Objednávky zadané <strong style="color: ${BRAND.charcoal};">dnes</strong> stihnu odeslat tak, aby dorazily včas. Nenechávej to na poslední chvíli.
    </p>

    ${renderInfoCard(
      `<p style="margin: 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoal}; line-height: 1.6;"><strong style="color: ${BRAND.success};">Doprava zdarma nad 1 500 Kč.</strong> Objednej dnes &mdash; odešlu do 3 dnů.</p>`,
      "success",
    )}

    ${productsHtml}

    <div style="margin: 28px 0 4px;">
      ${renderButton({ href: ctaUrl, label: "Objednat pro mámu", variant: "primary" })}
    </div>`;

  return buildMothersDayEmailShell(
    MOTHERS_DAY_PREVIEWS[3],
    recipientEmail,
    innerHtml,
  );
}

const MOTHERS_DAY_BUILDERS: Record<
  MothersDayEmailNumber,
  (products: CampaignProduct[], email: string) => string
> = {
  1: buildMothersDayEmail1Html,
  2: buildMothersDayEmail2Html,
  3: buildMothersDayEmail3Html,
};

/**
 * Render a Mother's Day campaign email (subject + HTML) without sending.
 * Used by admin dry-run / preview UI.
 */
export function renderMothersDayPreview(
  emailNumber: MothersDayEmailNumber,
  segment: MothersDaySegment,
  products: CampaignProduct[],
  recipientEmail: string,
): { subject: string; html: string } {
  return {
    subject: MOTHERS_DAY_SUBJECTS[emailNumber][segment],
    html: MOTHERS_DAY_BUILDERS[emailNumber](products, recipientEmail),
  };
}

/**
 * Send a Mother's Day campaign email to one recipient.
 * Returns true on success, false on failure (non-throwing for batch use).
 */
export async function sendMothersDayEmail(
  emailNumber: MothersDayEmailNumber,
  segment: MothersDaySegment,
  products: CampaignProduct[],
  recipientEmail: string,
): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping Mother's Day campaign");
    return false;
  }

  try {
    await mailer.sendMail({
      from: FROM_NEWSLETTER,
      replyTo: REPLY_TO,
      to: recipientEmail,
      subject: MOTHERS_DAY_SUBJECTS[emailNumber][segment],
      html: MOTHERS_DAY_BUILDERS[emailNumber](products, recipientEmail),
    });
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send Mother's Day email ${emailNumber} to ${recipientEmail}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// EU Customs Duty 2026 — 2-email campaign (Task #104)
// ---------------------------------------------------------------------------

export type CustomsEmailNumber = 1 | 2;

const CUSTOMS_SUBJECTS: Record<CustomsEmailNumber, string> = {
  1: "Tipy pro chytré nakupování léto 2026",
  2: "Než se změní pravidla dovozu — nakup dnes",
};

const CUSTOMS_PREVIEWS: Record<CustomsEmailNumber, string> = {
  1: "Od července se mění dovozní pravidla. My jsme tu doma.",
  2: "Od 1. července platí nová cla. U Janičky se nic nemění.",
};

function buildCustomsEmailShell(
  previewText: string,
  recipientEmail: string,
  innerHtml: string,
): string {
  const baseUrl = getBaseUrl();
  return renderLayout({
    preheader: previewText,
    contentHtml: innerHtml,
    footerNote: "<em>Nakupuj lokálně &mdash; bez cel, bez překvapení.</em>",
    unsubscribeUrl: `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}`,
    unsubscribeText: "Tenhle email ti chodí, protože odebíráš novinky z Janičky.",
  });
}

// --- Email 1: Soft tease (June 15) ---

function buildCustomsEmail1Html(
  products: CampaignProduct[],
  recipientEmail: string,
): string {
  const baseUrl = getBaseUrl();
  const infoUrl = `${baseUrl}/nakupuj-cesky`;
  const shopUrl = `${baseUrl}/products?sort=newest`;

  const productsHtml = products.length > 0
    ? renderProductGrid(campaignsToGridItems(products, "Bez cla · z Česka"), 2)
    : "";

  const compareTable = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0; border-collapse: separate; border-spacing: 0;">
      <tr>
        <td valign="top" style="width: 50%; padding: 18px; background: ${BRAND.dangerSoft}; border-radius: 12px 0 0 12px;">
          <p style="margin: 0 0 8px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 700; color: ${BRAND.danger}; text-transform: uppercase; letter-spacing: 0.12em;">Ze zahraničí</p>
          <p style="margin: 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoal}; line-height: 1.6;">Cena + clo + DPH.<br/>2&ndash;6 týdnů čekání.<br/>Kvalita nejistá.</p>
        </td>
        <td valign="top" style="width: 50%; padding: 18px; background: ${BRAND.successSoft}; border-radius: 0 12px 12px 0;">
          <p style="margin: 0 0 8px; font-family: ${FONTS.sans}; font-size: 11px; font-weight: 700; color: ${BRAND.success}; text-transform: uppercase; letter-spacing: 0.12em;">Janička</p>
          <p style="margin: 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoal}; line-height: 1.6;">Cena = finální cena.<br/>Doručení do 3 dnů.<br/>Ověřená kvalita.</p>
        </td>
      </tr>
    </table>`;

  const innerHtml = `
    ${renderEyebrow("Léto 2026 · pravidla dovozu")}
    ${renderDisplayHeading("Chytré nakupování bez celních překvapení.")}
    <p style="margin: 0 0 16px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Věděla jsi, že od <strong style="color: ${BRAND.charcoal};">1. července 2026</strong> se mění pravidla dovozu do EU? Zásilky ze Sheinu, Temu i Aliexpressu budou nově podléhat clu &mdash; minimálně <strong style="color: ${BRAND.charcoal};">75 Kč navíc</strong> za každou kategorii zboží.
    </p>
    <p style="margin: 0 0 4px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      U mě se nic nemění. Český eshop &mdash; žádná cla, žádné čekání na celnici, žádná překvapení.
    </p>

    ${compareTable}
    ${productsHtml}

    <div style="margin: 28px 0 12px;">
      ${renderButton({ href: infoUrl, label: "Zjistit víc o změnách", variant: "outline" })}
    </div>
    <p style="margin: 0; text-align: center; font-family: ${FONTS.sans}; font-size: 13px;">
      <a href="${shopUrl}" style="color: ${BRAND.charcoalSoft}; text-decoration: underline;">Nebo rovnou na nové kousky &rarr;</a>
    </p>`;

  return buildCustomsEmailShell(CUSTOMS_PREVIEWS[1], recipientEmail, innerHtml);
}

// --- Email 2: Final push (June 28) ---

function buildCustomsEmail2Html(
  products: CampaignProduct[],
  recipientEmail: string,
): string {
  const baseUrl = getBaseUrl();
  const shopUrl = `${baseUrl}/products?sort=newest`;
  const infoUrl = `${baseUrl}/nakupuj-cesky`;

  const productsHtml = products.length > 0
    ? renderProductGrid(campaignsToGridItems(products, "Bez cla · z Česka"), 2)
    : "";

  const innerHtml = `
    ${renderEyebrow("Za 3 dny se mění dovoz")}
    ${renderDisplayHeading("Než se změní pravidla &mdash; nakup u svých.")}
    <p style="margin: 0 0 16px; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Od <strong style="color: ${BRAND.charcoal};">1. července</strong> platí nová cla na všechny zásilky ze zahraničí pod 150 €. Oblečení z Číny zdraží o 15&ndash;50 %.
    </p>

    ${renderInfoCard(
      `<p style="margin: 0; font-family: ${FONTS.sans}; font-size: 13px; color: ${BRAND.charcoal}; line-height: 1.7;"><strong style="color: ${BRAND.warning};">Šaty z Aliexpresu za 400 Kč?</strong><br/>Od července + 75 Kč clo + týdny čekání.<br/>U mě: kvalitní šaty od <strong>350 Kč</strong>, doručení do 3 dnů, <strong>žádné clo</strong>.</p>`,
      "warning",
    )}

    <p style="margin: 18px 0 0; font-family: ${FONTS.sans}; font-size: 15px; line-height: 1.7; color: ${BRAND.charcoalSoft};">
      Nakupuj chytře &mdash; lokálně, bez poplatků navíc. Každý kousek u mě je unikát, pečlivě zkontrolovaný a vyfocený. Víš přesně, co dostaneš.
    </p>

    ${productsHtml}

    <div style="margin: 28px 0 12px;">
      ${renderButton({ href: shopUrl, label: "Prohlédnout nabídku", variant: "primary" })}
    </div>
    <p style="margin: 0; text-align: center; font-family: ${FONTS.sans}; font-size: 13px;">
      <a href="${infoUrl}" style="color: ${BRAND.charcoalSoft}; text-decoration: underline;">Přečíst si víc o změnách &rarr;</a>
    </p>`;

  return buildCustomsEmailShell(CUSTOMS_PREVIEWS[2], recipientEmail, innerHtml);
}

const CUSTOMS_BUILDERS: Record<
  CustomsEmailNumber,
  (products: CampaignProduct[], email: string) => string
> = {
  1: buildCustomsEmail1Html,
  2: buildCustomsEmail2Html,
};

/**
 * Render an EU customs duty campaign email (subject + HTML) without sending.
 * Used by admin dry-run / preview UI.
 */
export function renderCustomsCampaignPreview(
  emailNumber: CustomsEmailNumber,
  products: CampaignProduct[],
  recipientEmail: string,
): { subject: string; html: string } {
  return {
    subject: CUSTOMS_SUBJECTS[emailNumber],
    html: CUSTOMS_BUILDERS[emailNumber](products, recipientEmail),
  };
}

/**
 * Send an EU customs duty campaign email to one recipient.
 * Returns true on success, false on failure (non-throwing for batch use).
 */
export async function sendCustomsCampaignEmail(
  emailNumber: CustomsEmailNumber,
  products: CampaignProduct[],
  recipientEmail: string,
): Promise<boolean> {
  const mailer = getMailer();
  if (!mailer) {
    logger.warn("[Email] SMTP not configured — skipping customs campaign");
    return false;
  }

  try {
    await mailer.sendMail({
      from: FROM_NEWSLETTER,
      replyTo: REPLY_TO,
      to: recipientEmail,
      subject: CUSTOMS_SUBJECTS[emailNumber],
      html: CUSTOMS_BUILDERS[emailNumber](products, recipientEmail),
    });
    return true;
  } catch (error) {
    logger.error(`[Email] Failed to send customs email ${emailNumber} to ${recipientEmail}:`, error);
    return false;
  }
}
