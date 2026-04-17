import { Resend } from "resend";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";

let cachedResend: Resend | null | undefined;

function getResendClient(): Resend | null {
  if (cachedResend !== undefined) return cachedResend;
  const key = process.env.RESEND_API_KEY;
  cachedResend = key ? new Resend(key) : null;
  return cachedResend;
}

const FROM_EMAIL = process.env.EMAIL_FROM ?? "Janička Shop <objednavky@janicka-shop.cz>";
const NEWSLETTER_FROM_EMAIL = process.env.NEWSLETTER_EMAIL_FROM ?? "Janička Shop <novinky@janicka-shop.cz>";

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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;

  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
          <strong style="color: #1a1a1a;">${escapeHtml(item.name)}</strong>
          <br/>
          <span style="color: #666; font-size: 13px;">
            ${item.size ? escapeHtml(item.size) : ""}${item.size && item.color ? " · " : ""}${item.color ? escapeHtml(item.color) : ""}
          </span>
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right; white-space: nowrap; vertical-align: top;">
          ${formatPriceCzk(item.price)}
        </td>
      </tr>`
    )
    .join("");

  const paymentLabel = PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod;
  const shippingLabel = SHIPPING_LABELS[data.shippingMethod] ?? data.shippingMethod;

  let shippingAddressHtml: string;
  if (data.shippingMethod === "packeta_pickup" && data.shippingPointId) {
    shippingAddressHtml = `
      <p style="margin: 4px 0 0; color: #333;">
        ${escapeHtml(data.shippingStreet ?? "")}
        <br/><span style="color: #666; font-size: 13px;">Výdejní místo #${escapeHtml(data.shippingPointId)}</span>
      </p>`;
  } else {
    shippingAddressHtml = `
      <p style="margin: 4px 0 0; color: #333;">
        ${escapeHtml(data.shippingName ?? "")}
        <br/>${escapeHtml(data.shippingStreet ?? "")}
        <br/>${escapeHtml(data.shippingZip ?? "")} ${escapeHtml(data.shippingCity ?? "")}
      </p>`;
  }

  const codFee = data.isCod ? data.total - data.subtotal - data.shipping : 0;

  const statusMessage = data.isCod
    ? `<p style="margin: 0; color: #92400e;">Platba na dobírku — zaplatíte ${formatPriceCzk(data.total)} při převzetí.</p>`
    : `<p style="margin: 0; color: #92400e;">Čekáme na potvrzení platby. Jakmile bude přijata, pošleme vám další email.</p>`;

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <!-- Header -->
    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
    </div>

    <!-- Main card -->
    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

      <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Děkujeme za objednávku!</h2>
      <p style="margin: 0 0 4px; color: #666;">
        Objednávka <strong style="color: #1a1a1a;">${escapeHtml(data.orderNumber)}</strong>
      </p>
      <p style="margin: 0 0 20px; color: #666; font-size: 14px;">
        ${escapeHtml(data.customerName)}, potvrzujeme přijetí vaší objednávky.
      </p>

      <!-- Status -->
      <div style="background: #fffbeb; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
        ${statusMessage}
      </div>

      <!-- Items -->
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px 0; border-bottom: 2px solid #e5e5e5; color: #666; font-weight: 500; font-size: 13px;">Položka</th>
            <th style="text-align: right; padding: 8px 0; border-bottom: 2px solid #e5e5e5; color: #666; font-weight: 500; font-size: 13px;">Cena</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <!-- Totals -->
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 16px;">
        <tr>
          <td style="padding: 4px 0; color: #666;">Mezisoučet</td>
          <td style="padding: 4px 0; text-align: right;">${formatPriceCzk(data.subtotal)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #666;">Doprava</td>
          <td style="padding: 4px 0; text-align: right;">${data.shipping === 0 ? "Zdarma" : formatPriceCzk(data.shipping)}</td>
        </tr>
        ${
          codFee > 0
            ? `<tr>
          <td style="padding: 4px 0; color: #666;">Dobírka</td>
          <td style="padding: 4px 0; text-align: right;">${formatPriceCzk(codFee)}</td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding: 12px 0 0; border-top: 2px solid #e5e5e5; font-size: 18px; font-weight: 700; color: #1a1a1a;">Celkem</td>
          <td style="padding: 12px 0 0; border-top: 2px solid #e5e5e5; font-size: 18px; font-weight: 700; text-align: right; color: #1a1a1a;">${formatPriceCzk(data.total)}</td>
        </tr>
      </table>

      <!-- Shipping + Payment info -->
      <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="vertical-align: top; padding-right: 16px; width: 50%;">
              <strong style="font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Doprava</strong>
              <p style="margin: 4px 0 0; color: #333;">${escapeHtml(shippingLabel)}</p>
              ${shippingAddressHtml}
            </td>
            <td style="vertical-align: top; width: 50%;">
              <strong style="font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Platba</strong>
              <p style="margin: 4px 0 0; color: #333;">${escapeHtml(paymentLabel)}</p>
            </td>
          </tr>
        </table>
      </div>

      ${
        data.expectedDeliveryDate
          ? `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #f0f0f0;">
        <strong style="font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Předpokládané doručení</strong>
        <div style="margin: 8px 0 0; background: #eff6ff; border-radius: 8px; padding: 10px 14px;">
          <p style="margin: 0; color: #1e40af; font-size: 14px; font-weight: 500;">do ${new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", year: "numeric" }).format(new Date(data.expectedDeliveryDate))}</p>
        </div>
      </div>`
          : ""
      }

      ${
        data.note
          ? `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #f0f0f0;">
        <strong style="font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.5px;">Poznámka</strong>
        <p style="margin: 4px 0 0; color: #333; font-size: 14px;">${escapeHtml(data.note)}</p>
      </div>`
          : ""
      }

      <!-- CTA -->
      <div style="text-align: center; margin-top: 28px;">
        <a href="${orderUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Zobrazit objednávku
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
      <p style="margin: 4px 0 0;">Tento email byl odeslán na ${escapeHtml(data.customerEmail)}, protože jste vytvořili objednávku.</p>
    </div>
  </div>
</body>
</html>`;
}

function buildPaymentConfirmedHtml(data: Pick<OrderEmailData, "orderNumber" | "customerName" | "total" | "accessToken">): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); text-align: center;">

      <div style="width: 64px; height: 64px; background: #ecfdf5; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 32px; line-height: 64px;">&#10003;</span>
      </div>

      <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Platba přijata!</h2>
      <p style="margin: 0 0 4px; color: #666;">
        ${escapeHtml(data.customerName)}, vaše platba za objednávku
        <strong style="color: #1a1a1a;">${escapeHtml(data.orderNumber)}</strong>
        ve výši <strong style="color: #1a1a1a;">${formatPriceCzk(data.total)}</strong>
        byla úspěšně přijata.
      </p>
      <p style="margin: 16px 0 0; color: #666; font-size: 14px;">
        Vaši objednávku nyní zpracováváme a budeme vás informovat o odeslání.
      </p>

      <div style="margin-top: 24px;">
        <a href="${orderUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Zobrazit objednávku
        </a>
      </div>
    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
    </div>
  </div>
</body>
</html>`;
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
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping order confirmation email");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.customerEmail,
      subject: `Potvrzení objednávky ${data.orderNumber} — Janička Shop`,
      html: buildOrderConfirmationHtml(data),
    });
  } catch (error) {
    console.error(`[Email] Failed to send order confirmation for ${data.orderNumber}:`, error);
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
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping payment confirmed email");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.customerEmail,
      subject: `Platba přijata — ${data.orderNumber} — Janička Shop`,
      html: buildPaymentConfirmedHtml(data),
    });
  } catch (error) {
    console.error(`[Email] Failed to send payment confirmed email for ${data.orderNumber}:`, error);
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

function buildStatusEmailWrapper(content: string, data: Pick<StatusEmailData, "orderNumber" | "accessToken">): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      ${content}

      <div style="text-align: center; margin-top: 24px;">
        <a href="${orderUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Zobrazit objednávku
        </a>
      </div>
    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
    </div>
  </div>
</body>
</html>`;
}

function buildOrderConfirmedHtml(data: StatusEmailData): string {
  return buildStatusEmailWrapper(`
      <div style="text-align: center;">
        <div style="width: 64px; height: 64px; background: #dbeafe; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#9989;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Objednávka potvrzena</h2>
        <p style="margin: 0 0 4px; color: #666;">
          ${escapeHtml(data.customerName)}, vaše objednávka
          <strong style="color: #1a1a1a;">${escapeHtml(data.orderNumber)}</strong>
          byla potvrzena a připravujeme ji k odeslání.
        </p>
        <p style="margin: 16px 0 0; color: #666; font-size: 14px;">
          O odeslání vás budeme informovat dalším emailem.
        </p>
      </div>`, data);
}

function buildOrderShippedHtml(data: StatusEmailData): string {
  const trackingHtml = data.trackingNumber
    ? `<div style="background: #f5f3ff; border-radius: 8px; padding: 12px 16px; margin: 16px auto 0; display: inline-block;">
          <p style="margin: 0; color: #666; font-size: 13px;">Sledovací číslo zásilky:</p>
          <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #1a1a1a; letter-spacing: 0.5px;">${escapeHtml(data.trackingNumber)}</p>
        </div>`
    : "";

  return buildStatusEmailWrapper(`
      <div style="text-align: center;">
        <div style="width: 64px; height: 64px; background: #ede9fe; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#128230;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Objednávka odeslána!</h2>
        <p style="margin: 0 0 4px; color: #666;">
          ${escapeHtml(data.customerName)}, vaše objednávka
          <strong style="color: #1a1a1a;">${escapeHtml(data.orderNumber)}</strong>
          ve výši <strong style="color: #1a1a1a;">${formatPriceCzk(data.total)}</strong>
          byla odeslána.
        </p>
        ${trackingHtml}
        <p style="margin: 16px 0 0; color: #666; font-size: 14px;">
          Zásilka je na cestě k vám. Sledujte stav doručení na stránce objednávky.
        </p>
      </div>`, data);
}

function buildOrderDeliveredHtml(data: StatusEmailData): string {
  return buildStatusEmailWrapper(`
      <div style="text-align: center;">
        <div style="width: 64px; height: 64px; background: #ecfdf5; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#127881;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Doručeno!</h2>
        <p style="margin: 0 0 4px; color: #666;">
          ${escapeHtml(data.customerName)}, vaše objednávka
          <strong style="color: #1a1a1a;">${escapeHtml(data.orderNumber)}</strong>
          byla úspěšně doručena.
        </p>
        <p style="margin: 16px 0 0; color: #666; font-size: 14px;">
          Děkujeme za nákup! Doufáme, že vás vaše nové kousky potěší.
        </p>
      </div>`, data);
}

function buildOrderCancelledHtml(data: StatusEmailData): string {
  return buildStatusEmailWrapper(`
      <div style="text-align: center;">
        <div style="width: 64px; height: 64px; background: #fef2f2; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#10060;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Objednávka zrušena</h2>
        <p style="margin: 0 0 4px; color: #666;">
          ${escapeHtml(data.customerName)}, vaše objednávka
          <strong style="color: #1a1a1a;">${escapeHtml(data.orderNumber)}</strong>
          byla zrušena.
        </p>
        <p style="margin: 16px 0 0; color: #666; font-size: 14px;">
          Pokud máte jakékoliv dotazy, neváhejte nás kontaktovat.
        </p>
      </div>`, data);
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

  const resend = getResendClient();
  if (!resend) {
    console.warn(`[Email] RESEND_API_KEY not set — skipping ${newStatus} email`);
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.customerEmail,
      subject: `${subject} — ${data.orderNumber} — Janička Shop`,
      html: builder(data),
    });
  } catch (error) {
    console.error(`[Email] Failed to send ${newStatus} email for ${data.orderNumber}:`, error);
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  const cards = products
    .map((p) => {
      const productUrl = `${baseUrl}/products/${p.slug}`;
      const imageHtml = p.image
        ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px 8px 0 0; display: block;" />`
        : `<div style="width: 100%; height: 180px; background: #f5f5f5; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center;"><span style="font-size: 40px;">&#128087;</span></div>`;

      const discount = p.compareAt && p.compareAt > p.price
        ? Math.round(((p.compareAt - p.price) / p.compareAt) * 100)
        : null;

      const priceHtml = discount
        ? `<span style="text-decoration: line-through; color: #999; font-size: 11px;">${formatPriceCzk(p.compareAt!)}</span> <strong style="color: #dc2626; font-size: 14px;">${formatPriceCzk(p.price)}</strong>`
        : `<strong style="color: #1a1a1a; font-size: 14px;">${formatPriceCzk(p.price)}</strong>`;

      const conditionLabel = CONDITION_LABELS_SHIPPING[p.condition] ?? p.condition;
      const sizesText = p.sizes.length > 0 ? p.sizes.join(", ") : null;

      return `
        <td style="width: 50%; padding: 6px; vertical-align: top;">
          <a href="${productUrl}" style="text-decoration: none; display: block; border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden;">
            ${imageHtml}
            <div style="padding: 10px;">
              <p style="margin: 0; color: #1a1a1a; font-size: 13px; font-weight: 600; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</p>
              ${p.brand ? `<p style="margin: 2px 0 0; color: #888; font-size: 11px;">${escapeHtml(p.brand)}</p>` : ""}
              <p style="margin: 2px 0 0; color: #666; font-size: 11px;">${escapeHtml(conditionLabel)}${sizesText ? ` · Vel.: ${escapeHtml(sizesText)}` : ""}</p>
              <p style="margin: 6px 0 0;">${priceHtml}</p>
            </div>
          </a>
        </td>`;
    });

  // Build rows of 2 products each
  const rows: string[] = [];
  for (let i = 0; i < cards.length; i += 2) {
    const second = cards[i + 1] ?? '<td style="width: 50%; padding: 6px;"></td>';
    rows.push(`<tr>${cards[i]}${second}</tr>`);
  }

  return `
    <div style="margin-top: 28px; border-top: 1px solid #f0f0f0; padding-top: 24px;">
      <h3 style="margin: 0 0 12px; font-size: 16px; color: #1a1a1a; text-align: center;">Mohlo by se ti l&iacute;bit</h3>
      <table style="width: 100%; border-collapse: collapse;">
        ${rows.join("")}
      </table>
      <div style="text-align: center; margin-top: 16px;">
        <a href="${baseUrl}/products?sort=newest" style="color: #1a1a1a; font-size: 13px; text-decoration: underline;">Prohl&eacute;dnout v&scaron;echny kousky &rarr;</a>
      </div>
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;

  const trackingHtml = data.trackingNumber
    ? `<div style="background: #f5f3ff; border-radius: 8px; padding: 12px 16px; margin: 16px auto 0; display: inline-block;">
          <p style="margin: 0; color: #666; font-size: 13px;">Sledovac&iacute; &ccaron;&iacute;slo z&aacute;silky:</p>
          <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #1a1a1a; letter-spacing: 0.5px;">${escapeHtml(data.trackingNumber)}</p>
        </div>`
    : "";

  const itemsHtml = data.items.length > 0
    ? `<div style="margin-top: 20px; border-top: 1px solid #f0f0f0; padding-top: 16px;">
        <p style="margin: 0 0 8px; font-size: 13px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Tvoje kousky</p>
        ${data.items.map((item) => `
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #fafafa;">
            <span style="color: #333; font-size: 14px;">${escapeHtml(item.name)}${item.size ? ` <span style="color: #999;">(${escapeHtml(item.size)})</span>` : ""}</span>
            <span style="color: #1a1a1a; font-weight: 600; font-size: 14px;">${formatPriceCzk(item.price)}</span>
          </div>`).join("")}
        <div style="display: flex; justify-content: space-between; padding: 10px 0 0; margin-top: 4px;">
          <span style="color: #1a1a1a; font-weight: 700; font-size: 15px;">Celkem</span>
          <span style="color: #1a1a1a; font-weight: 700; font-size: 15px;">${formatPriceCzk(data.total)}</span>
        </div>
      </div>`
    : "";

  const crossSellHtml = buildCrossSellProductsHtml(data.crossSellProducts);

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Jani&ccaron;ka Shop</h1>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

      <div style="text-align: center;">
        <div style="width: 64px; height: 64px; background: #ede9fe; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#128230;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Objedn&aacute;vka odesl&aacute;na!</h2>
        <p style="margin: 0 0 4px; color: #666;">
          ${escapeHtml(data.customerName)}, tvoje objedn&aacute;vka
          <strong style="color: #1a1a1a;">${escapeHtml(data.orderNumber)}</strong>
          je na cest&ecaron; k tob&ecaron;.
        </p>
        ${trackingHtml}
      </div>

      ${itemsHtml}

      <div style="text-align: center; margin-top: 24px;">
        <a href="${orderUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Zobrazit objedn&aacute;vku
        </a>
      </div>

      ${crossSellHtml}
    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Jani&ccaron;ka Shop &mdash; Second hand m&oacute;da</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send enhanced shipping notification email with cross-sell product recommendations.
 * Used instead of generic status email when order transitions to "shipped".
 * Cross-sell products should be same category + matching sizes from live inventory.
 * Returns true on success, false on failure.
 */
export async function sendShippingNotificationEmail(data: ShippingNotificationData): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping shipping notification email");
    return false;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.customerEmail,
      subject: `Objedn\u00e1vka odesl\u00e1na \u2014 ${data.orderNumber} \u2014 Jani\u010dka Shop`,
      html: buildShippingNotificationHtml(data),
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send shipping notification for ${data.orderNumber}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Newsletter welcome email
// ---------------------------------------------------------------------------

function buildNewsletterWelcomeHtml(email: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Second hand móda pro tebe</p>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); text-align: center;">

      <div style="width: 64px; height: 64px; background: #fce7f3; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 32px; line-height: 64px;">&#128140;</span>
      </div>

      <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Vítej v Janičce!</h2>
      <p style="margin: 0 0 16px; color: #666; font-size: 15px; line-height: 1.6;">
        Díky za přihlášení k odběru novinek. Jako první se dozvíš o nových kouscích, slevách a exkluzivních nabídkách.
      </p>

      <div style="background: #fdf4ff; border-radius: 8px; padding: 16px 20px; margin: 20px 0; text-align: left;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a1a; font-size: 14px;">Co tě u nás čeká:</p>
        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.8;">
          &#10024; Pečlivě vybrané kousky — každý je unikát<br/>
          &#128722; Nové přírůstky každý týden<br/>
          &#127793; Udržitelná móda za zlomek původní ceny<br/>
          &#128230; Rychlé doručení přes Zásilkovnu nebo Českou poštu
        </p>
      </div>

      <div style="margin-top: 24px;">
        <a href="${baseUrl}/products?sort=newest" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Prohlédnout novinky
        </a>
      </div>
    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
      <p style="margin: 4px 0 0;">Tento email jsi dostala, protože jsi se přihlásila k odběru novinek.</p>
      <p style="margin: 4px 0 0;"><a href="${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(email))}" style="color: #999; text-decoration: underline;">Odhlásit se z odběru</a></p>
    </div>
  </div>
</body>
</html>`;
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const adminUrl = data.orderId
    ? `${baseUrl}/admin/orders/${data.orderId}`
    : `${baseUrl}/admin/orders`;
  const headline = data.paid ? "Platba potvrzena" : "Nová objednávka!";

  const itemsHtml = data.items
    .map(
      (item) => `
        <tr>
          <td style="padding: 6px 0; font-size: 14px; color: #333;">${escapeHtml(item.name)}</td>
          <td style="padding: 6px 0; font-size: 14px; color: #333; text-align: right; white-space: nowrap;">${formatPriceCzk(item.price)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">
    <div style="text-align: center; padding: 16px 0;">
      <h1 style="margin: 0; font-size: 20px; color: #1a1a1a;">${headline}</h1>
    </div>
    <div style="background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #666;">Objednávka</td>
          <td style="padding: 4px 0; font-size: 13px; font-weight: 600; color: #1a1a1a; text-align: right;">${escapeHtml(data.orderNumber)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #666;">Zákazník</td>
          <td style="padding: 4px 0; font-size: 13px; color: #1a1a1a; text-align: right;">${escapeHtml(data.customerName)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #666;">Email</td>
          <td style="padding: 4px 0; font-size: 13px; color: #1a1a1a; text-align: right;">${escapeHtml(data.customerEmail)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #666;">Platba</td>
          <td style="padding: 4px 0; font-size: 13px; color: #1a1a1a; text-align: right;">${PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #666;">Doprava</td>
          <td style="padding: 4px 0; font-size: 13px; color: #1a1a1a; text-align: right;">${SHIPPING_LABELS[data.shippingMethod] ?? data.shippingMethod}</td>
        </tr>
      </table>

      <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />

      <table style="width: 100%; border-collapse: collapse;">
        ${itemsHtml}
      </table>

      <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />

      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #1a1a1a; text-align: right;">
        Celkem: ${formatPriceCzk(data.total)}
      </p>

      <div style="text-align: center; margin-top: 20px;">
        <a href="${adminUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Zobrazit v adminu
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send notification email to admin when a new order is placed.
 * Non-blocking: logs errors instead of throwing.
 */
export async function sendAdminNewOrderEmail(data: AdminOrderNotificationData): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping admin order notification");
    return;
  }

  const config = await resolveAdminNotificationConfig();
  if (!config.notifyOnNewOrder) {
    return;
  }
  if (!config.email) {
    console.warn("[Email] No admin notification email configured — skipping admin order notification");
    return;
  }

  const subjectPrefix = data.paid ? "Platba potvrzena" : "Nová objednávka";
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: config.email,
      subject: `${subjectPrefix} ${data.orderNumber} — ${formatPriceCzk(data.total)}`,
      html: buildAdminNewOrderHtml(data),
    });
  } catch (error) {
    console.error(`[Email] Failed to send admin notification for ${data.orderNumber}:`, error);
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
  const resend = getResendClient();
  if (!resend) return false;

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
          ? `<span style="color:#dc2626;font-weight:600">Po termínu (${Math.abs(o.daysRemaining)} dní)</span>`
          : o.daysRemaining === 0
            ? `<span style="color:#d97706;font-weight:600">Dnes!</span>`
            : `<span style="color:#d97706">Zbývá ${o.daysRemaining} dní</span>`;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${o.orderNumber}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${o.customerName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${formatPriceCzk(o.total)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${formatDate(o.expectedDeliveryDate)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${urgency}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1f2937">Upozornění na termín doručení</h2>
      <p style="color:#6b7280">Podle českého zákona musí být objednávky doručeny do 30 dní od uzavření smlouvy.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Objednávka</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Zákazník</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Celkem</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Termín</th>
            <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb">Stav</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px;color:#6b7280;font-size:13px">
        Zkontrolujte tyto objednávky v <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "https://janicka-shop.vercel.app"}/admin/orders">admin panelu</a>.
      </p>
    </div>`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("[Email] Failed to send deadline alert:", error);
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
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping email-change verify");
    return;
  }
  const safeName = escapeHtml(data.firstName || "");
  const safeUrl = escapeHtml(data.verifyUrl);
  const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#faf8f5;padding:24px;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <h1 style="font-size:22px;margin:0 0 16px;">Potvrď změnu emailu ${safeName ? `, ${safeName}` : ""}</h1>
    <p style="line-height:1.6;color:#444;">Požádala jsi o změnu přihlašovacího emailu pro svůj účet v Janička Shop. Pro dokončení klikni na tlačítko níže — odkaz je platný 1 hodinu.</p>
    <p style="margin:24px 0;"><a href="${safeUrl}" style="display:inline-block;background:#1a1a1a;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:500;">Potvrdit změnu emailu</a></p>
    <p style="line-height:1.6;color:#888;font-size:13px;">Pokud jsi o změnu nepožádala, tenhle email ignoruj — ke změně nedojde.</p>
    <p style="line-height:1.6;color:#888;font-size:12px;margin-top:24px;">Odkaz nefunguje? Zkopíruj ho do prohlížeče:<br/>${safeUrl}</p>
  </div>
</body></html>`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.newEmail,
      subject: "Potvrď změnu emailu — Janička Shop",
      html,
    });
  } catch (error) {
    console.error(`[Email] Failed to send email-change verify to ${data.newEmail}:`, error);
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
  const resend = getResendClient();
  if (!resend) return;
  const safeName = escapeHtml(data.firstName || "");
  const safeNew = escapeHtml(data.newEmail);
  const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#faf8f5;padding:24px;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <h1 style="font-size:22px;margin:0 0 16px;">Email na tvém účtu byl změněn ${safeName ? `, ${safeName}` : ""}</h1>
    <p style="line-height:1.6;color:#444;">Přihlašovací email tvého účtu byl právě změněn na <strong>${safeNew}</strong>.</p>
    <p style="line-height:1.6;color:#444;">Pokud jsi to byla ty, nemusíš dělat nic.</p>
    <p style="line-height:1.6;color:#b84040;margin-top:16px;"><strong>Nebyla jsi to ty?</strong> Ozvi se nám okamžitě na <a href="mailto:objednavky@janicka-shop.cz" style="color:#b84040;">objednavky@janicka-shop.cz</a> — změnu vrátíme a účet zabezpečíme.</p>
  </div>
</body></html>`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.oldEmail,
      subject: "Email tvého účtu byl změněn — Janička Shop",
      html,
    });
  } catch (error) {
    console.error(`[Email] Failed to send email-change notice to ${data.oldEmail}:`, error);
  }
}

/** Confirm to the customer that GDPR deletion has completed. */
export async function sendAccountDeletedEmail(data: {
  email: string;
  firstName: string;
}): Promise<void> {
  const resend = getResendClient();
  if (!resend) return;
  const safeName = escapeHtml(data.firstName || "");
  const html = `<!DOCTYPE html><html lang="cs"><head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#faf8f5;padding:24px;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    <h1 style="font-size:22px;margin:0 0 16px;">Tvůj účet byl smazán ${safeName ? `, ${safeName}` : ""}</h1>
    <p style="line-height:1.6;color:#444;">Tvé osobní údaje jsme anonymizovali. Historii objednávek uchováváme 10 let podle zákona o účetnictví — už ale bez tvých osobních údajů.</p>
    <p style="line-height:1.6;color:#444;">Děkujeme za čas u nás. Kdybys chtěla účet znovu, stačí si ho založit s novým registračním emailem.</p>
  </div>
</body></html>`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: "Tvůj účet byl smazán — Janička Shop",
      html,
    });
  } catch (error) {
    console.error(`[Email] Failed to send account-deleted email to ${data.email}:`, error);
  }
}

export async function sendNewsletterWelcomeEmail(email: string): Promise<void> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping newsletter welcome email");
    return;
  }

  try {
    await resend.emails.send({
      from: NEWSLETTER_FROM_EMAIL,
      to: email,
      subject: "Vítej v Janičce! — Janička Shop",
      html: buildNewsletterWelcomeHtml(email),
    });
  } catch (error) {
    console.error(`[Email] Failed to send newsletter welcome email to ${email}:`, error);
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

function buildCartItemsHtml(items: AbandonedCartItem[]): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  return items
    .map((item) => {
      const productUrl = item.slug ? `${baseUrl}/products/${item.slug}` : baseUrl;
      const imageHtml = item.image
        ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #f0f0f0;" />`
        : `<div style="width: 80px; height: 80px; background: #f5f5f5; border-radius: 8px;"></div>`;
      const detailParts = [item.size, item.color].filter(Boolean).join(" · ");
      return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; vertical-align: top; width: 80px;">
            <a href="${productUrl}">${imageHtml}</a>
          </td>
          <td style="padding: 12px 0 12px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top;">
            <a href="${productUrl}" style="color: #1a1a1a; text-decoration: none; font-weight: 500; font-size: 14px;">${escapeHtml(item.name)}</a>
            ${detailParts ? `<br/><span style="color: #666; font-size: 13px;">${escapeHtml(detailParts)}</span>` : ""}
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right; vertical-align: top; white-space: nowrap; font-weight: 500;">
            ${formatPriceCzk(item.price)}
          </td>
        </tr>`;
    })
    .join("");
}

function buildAbandonedCartEmailWrapper(
  content: string,
  ctaText: string,
  ctaUrl: string,
  cartId: string,
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe/abandoned-cart/${encodeURIComponent(cartId)}`;
  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Second hand móda pro tebe</p>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      ${content}

      <div style="text-align: center; margin-top: 28px;">
        <a href="${ctaUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">
          ${escapeHtml(ctaText)}
        </a>
      </div>
    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
      <p style="margin: 4px 0 0;">
        Nechceš dostávat tyto emaily?
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Odhlásit se</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Email 1: Sent 30-60 minutes after abandonment.
 * "Zapomněla jsi na svůj kousek?" — gentle reminder with product images.
 */
function buildAbandonedCartEmail1(data: AbandonedCartEmailData): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const greeting = data.customerName ? escapeHtml(data.customerName) : "Ahoj";

  return buildAbandonedCartEmailWrapper(
    `
      <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Zapomněla jsi na svůj kousek?</h2>
      <p style="margin: 0 0 16px; color: #666; font-size: 15px; line-height: 1.6;">
        ${greeting}, všimly jsme si, že máš v košíku pár krásných kousků. Každý z nich je unikát — jakmile ho někdo koupí, je pryč.
      </p>

      <div style="background: #fffbeb; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">
          Tento kousek je unikát — kdokoliv ho může koupit.
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse;">
        ${buildCartItemsHtml(data.items)}
      </table>

      <div style="text-align: right; margin-top: 12px;">
        <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1a1a1a;">
          Celkem: ${formatPriceCzk(data.cartTotal)}
        </p>
      </div>`,
    "Dokončit objednávku",
    `${baseUrl}/checkout`,
    data.cartId,
  );
}

/**
 * Email 2: Sent 12-24 hours after abandonment.
 * "Stále na tebe čeká..." — follow-up, mentions if item was sold.
 * @param soldProductIds - productIds of items that have been sold (matched by ID, not name).
 */
function buildAbandonedCartEmail2(data: AbandonedCartEmailData, soldProductIds: string[]): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const greeting = data.customerName ? escapeHtml(data.customerName) : "Ahoj";
  const soldIdSet = new Set(soldProductIds);
  const soldItems = data.items.filter((i) => soldIdSet.has(i.productId));
  const availableItems = data.items.filter((i) => !soldIdSet.has(i.productId));

  let soldNotice = "";
  if (soldItems.length > 0) {
    soldNotice = `
      <div style="background: #fef2f2; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <p style="margin: 0; color: #991b1b; font-size: 14px;">
          Bohužel, ${soldItems.map((i) => `<strong>${escapeHtml(i.name)}</strong>`).join(", ")} už ${soldItems.length === 1 ? "našel" : "našly"} novou majitelku.
          ${availableItems.length > 0 ? "Ale ostatní kousky stále čekají!" : ""}
        </p>
      </div>`;
  }

  const itemsHtml = availableItems.length > 0
    ? `<table style="width: 100%; border-collapse: collapse;">${buildCartItemsHtml(availableItems)}</table>`
    : "";

  const ctaText = availableItems.length > 0 ? "Dokončit objednávku" : "Prohlédnout podobné kousky";
  const ctaUrl = availableItems.length > 0 ? `${baseUrl}/checkout` : `${baseUrl}/products?sort=newest`;

  return buildAbandonedCartEmailWrapper(
    `
      <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Stále na tebe čeká...</h2>
      <p style="margin: 0 0 16px; color: #666; font-size: 15px; line-height: 1.6;">
        ${greeting}, tvůj košík se tu na tebe stále drží. U second handu ale nikdy nevíš — každý kousek je tu jen jednou.
      </p>

      ${soldNotice}
      ${itemsHtml}
      ${availableItems.length > 0 ? `<div style="text-align: right; margin-top: 12px;"><p style="margin: 0; font-size: 16px; font-weight: 700; color: #1a1a1a;">Celkem: ${formatPriceCzk(availableItems.reduce((sum, i) => sum + i.price, 0))}</p></div>` : ""}`,
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const greeting = data.customerName ? escapeHtml(data.customerName) : "Ahoj";
  const soldIdSet = new Set(soldProductIds);
  const soldItems = data.items.filter((i) => soldIdSet.has(i.productId));
  const availableItems = data.items.filter((i) => !soldIdSet.has(i.productId));

  let soldNotice = "";
  if (soldItems.length > 0) {
    soldNotice = `
      <div style="background: #fef2f2; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">
        <p style="margin: 0; color: #991b1b; font-size: 14px;">
          ${soldItems.map((i) => `<strong>${escapeHtml(i.name)}</strong>`).join(", ")} — ${soldItems.length === 1 ? "bohužel prodáno" : "bohužel prodány"}.
          <a href="${baseUrl}/products?sort=newest" style="color: #991b1b; text-decoration: underline;">Podívej se na podobné kousky &rarr;</a>
        </p>
      </div>`;
  }

  const itemsHtml = availableItems.length > 0
    ? `<table style="width: 100%; border-collapse: collapse;">${buildCartItemsHtml(availableItems)}</table>`
    : "";

  const ctaText = availableItems.length > 0 ? "Naposledy — dokončit objednávku" : "Prohlédnout novinky";
  const ctaUrl = availableItems.length > 0 ? `${baseUrl}/checkout` : `${baseUrl}/products?sort=newest`;

  return buildAbandonedCartEmailWrapper(
    `
      <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Poslední upozornění</h2>
      <p style="margin: 0 0 16px; color: #666; font-size: 15px; line-height: 1.6;">
        ${greeting}, tohle je poslední připomenutí — pak tvůj košík vyprší.
        ${availableItems.length > 0 ? "Tyto kousky jsou stále dostupné, ale u second handu nikdy nevíš, jak dlouho vydrží." : ""}
      </p>

      ${soldNotice}
      ${itemsHtml}
      ${availableItems.length > 0 ? `<div style="text-align: right; margin-top: 12px;"><p style="margin: 0; font-size: 16px; font-weight: 700; color: #1a1a1a;">Celkem: ${formatPriceCzk(availableItems.reduce((sum, i) => sum + i.price, 0))}</p></div>` : ""}`,
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
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping abandoned cart email");
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
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: subjects[stage],
      html,
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send abandoned cart email #${stage} to ${data.email}:`, error);
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;
  const shopUrl = `${baseUrl}/products?sort=newest`;

  const itemsList = data.items
    .map((item) => {
      const detail = [item.size, item.color].filter(Boolean).join(" · ");
      return `<li style="padding: 4px 0; color: #333;">${escapeHtml(item.name)}${detail ? ` <span style="color: #666; font-size: 13px;">(${escapeHtml(detail)})</span>` : ""}</li>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Second hand móda pro tebe</p>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

      <div style="text-align: center;">
        <div style="width: 64px; height: 64px; background: #fdf4ff; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#11088;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Jak jsi spokojená?</h2>
        <p style="margin: 0 0 16px; color: #666; font-size: 15px; line-height: 1.6;">
          ${escapeHtml(data.customerName)}, tvoje objednávka <strong style="color: #1a1a1a;">${escapeHtml(data.orderNumber)}</strong> je u tebe už týden. Rádi bychom věděli, jak jsi spokojená!
        </p>
      </div>

      <div style="background: #fdf4ff; border-radius: 8px; padding: 16px 20px; margin: 16px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a1a; font-size: 14px;">Tvoje kousky:</p>
        <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 1.6;">
          ${itemsList}
        </ul>
      </div>

      <p style="margin: 16px 0 0; color: #666; font-size: 14px; line-height: 1.6; text-align: center;">
        Tvůj názor nám pomáhá zlepšovat služby a pomůže dalším zákaznicím s rozhodováním.
      </p>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${orderUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Zobrazit objednávku
        </a>
      </div>

      <div style="text-align: center; margin-top: 16px;">
        <a href="${shopUrl}" style="color: #666; font-size: 13px; text-decoration: underline;">
          Prohlédnout novinky
        </a>
      </div>
    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
      <p style="margin: 4px 0 0;">Tento email jsi dostala, protože jsi u nás nakoupila.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send review request email 7 days after shipping.
 * Non-blocking: logs errors instead of throwing.
 */
export async function sendReviewRequestEmail(data: ReviewRequestEmailData): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping review request email");
    return false;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.customerEmail,
      subject: `Jak jsi spokojená? — ${data.orderNumber} — Janička Shop`,
      html: buildReviewRequestHtml(data),
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send review request email for ${data.orderNumber}:`, error);
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const orderUrl = `${baseUrl}/order/${data.orderNumber}?token=${data.accessToken}`;
  const returnsUrl = `${baseUrl}/returns`;

  const itemsList = data.items
    .map((item) => {
      const detail = [item.size, item.color].filter(Boolean).join(" · ");
      return `<li style="padding: 4px 0; color: #333;">${escapeHtml(item.name)}${detail ? ` <span style="color: #666; font-size: 13px;">(${escapeHtml(detail)})</span>` : ""}</li>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Second hand móda pro tebe</p>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

      <div style="text-align: center;">
        <div style="width: 64px; height: 64px; background: #f0fdf4; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#128230;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Dorazilo vše v pořádku?</h2>
        <p style="margin: 0 0 16px; color: #666; font-size: 15px; line-height: 1.6;">
          ${escapeHtml(data.customerName)}, tvůj balíček z objednávky <strong style="color: #1a1a1a;">${escapeHtml(data.orderNumber)}</strong> by už měl být u tebe. Chceme se ujistit, že je vše v pořádku.
        </p>
      </div>

      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px 20px; margin: 16px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #1a1a1a; font-size: 14px;">Tvoje kousky:</p>
        <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 1.6;">
          ${itemsList}
        </ul>
      </div>

      <p style="margin: 16px 0 0; color: #666; font-size: 14px; line-height: 1.6; text-align: center;">
        Pokud je cokoliv špatně nebo zásilka nedorazila, dej nám vědět — rádi to vyřešíme.
      </p>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${returnsUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Nahlásit problém
        </a>
      </div>

      <div style="text-align: center; margin-top: 12px;">
        <a href="${orderUrl}" style="color: #666; font-size: 13px; text-decoration: underline;">
          Zobrazit objednávku
        </a>
      </div>
    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
      <p style="margin: 4px 0 0;">Tento email jsi dostala, protože jsi u nás nakoupila.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send delivery check-in email ~4 days after shipping.
 * Pure care email — no marketing, no cross-sell.
 * Catches delivery issues early, reduces chargebacks, builds trust.
 * Non-blocking: logs errors instead of throwing.
 */
export async function sendDeliveryCheckEmail(data: DeliveryCheckEmailData): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping delivery check email");
    return false;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.customerEmail,
      subject: `Dorazilo vše v pořádku? — ${data.orderNumber} — Janička Shop`,
      html: buildDeliveryCheckHtml(data),
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send delivery check email for ${data.orderNumber}:`, error);
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

function buildNewArrivalProductsHtml(products: NewArrivalProduct[]): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  return products
    .map((p) => {
      const productUrl = `${baseUrl}/products/${p.slug}`;
      const imageHtml = p.image
        ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width: 120px; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #f0f0f0;" />`
        : `<div style="width: 120px; height: 150px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><span style="font-size: 32px;">&#128087;</span></div>`;

      const discount = p.compareAt && p.compareAt > p.price
        ? Math.round(((p.compareAt - p.price) / p.compareAt) * 100)
        : null;

      const priceHtml = discount
        ? `<span style="text-decoration: line-through; color: #999; font-size: 12px;">${formatPriceCzk(p.compareAt!)}</span> <strong style="color: #dc2626;">${formatPriceCzk(p.price)}</strong> <span style="background: #dc2626; color: #fff; font-size: 11px; padding: 1px 5px; border-radius: 4px;">-${discount}%</span>`
        : `<strong style="color: #1a1a1a;">${formatPriceCzk(p.price)}</strong>`;

      const conditionLabel = CONDITION_LABELS_EMAIL[p.condition] ?? p.condition;
      const sizesText = p.sizes.length > 0 ? p.sizes.join(", ") : null;

      return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; vertical-align: top; width: 120px;">
            <a href="${productUrl}" style="text-decoration: none;">${imageHtml}</a>
          </td>
          <td style="padding: 12px 0 12px 16px; border-bottom: 1px solid #f0f0f0; vertical-align: top;">
            <a href="${productUrl}" style="color: #1a1a1a; text-decoration: none; font-weight: 600; font-size: 14px; line-height: 1.3;">${escapeHtml(p.name)}</a>
            ${p.brand ? `<br/><span style="color: #888; font-size: 12px;">${escapeHtml(p.brand)}</span>` : ""}
            <br/><span style="color: #666; font-size: 12px;">${escapeHtml(conditionLabel)}</span>
            ${sizesText ? `<br/><span style="color: #666; font-size: 12px;">Vel.: ${escapeHtml(sizesText)}</span>` : ""}
            <div style="margin-top: 6px;">${priceHtml}</div>
          </td>
        </tr>`;
    })
    .join("");
}

function buildNewArrivalHtml(data: NewArrivalEmailData): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const shopUrl = `${baseUrl}/products?sort=newest`;
  const greeting = data.firstName
    ? `${escapeHtml(data.firstName)}, máme`
    : "Máme";

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Second hand móda pro tebe</p>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

      <div style="text-align: center;">
        <div style="width: 64px; height: 64px; background: #fce7f3; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#10024;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Nové kousky pro tebe!</h2>
        <p style="margin: 0 0 20px; color: #666; font-size: 15px; line-height: 1.6;">
          ${greeting} pro tebe nové kousky, které by se ti mohly líbit. Každý je unikát — když ti padne do oka, neváhej!
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse;">
        ${buildNewArrivalProductsHtml(data.products)}
      </table>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${shopUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Zobrazit všechny novinky
        </a>
      </div>

      <p style="margin: 20px 0 0; color: #999; font-size: 12px; text-align: center; line-height: 1.5;">
        Tento email jsi dostala, protože jsi přihlášená k odběru novinek z Janička Shop.
      </p>
    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
      <p style="margin: 4px 0 0;">
        <a href="${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(data.email))}" style="color: #999; text-decoration: underline;">Odhlásit se z odběru</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send new arrival notification email to a subscriber.
 * Returns true on success, false on failure.
 */
export async function sendNewArrivalEmail(data: NewArrivalEmailData): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping new arrival email");
    return false;
  }

  const count = data.products.length;
  const subject = count === 1
    ? `Nový kousek pro tebe! — Janička Shop`
    : `${count} nových kousků pro tebe! — Janička Shop`;

  try {
    await resend.emails.send({
      from: NEWSLETTER_FROM_EMAIL,
      to: data.email,
      subject,
      html: buildNewArrivalHtml(data),
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send new arrival email to ${data.email}:`, error);
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const productUrl = `${baseUrl}/products/${encodeURIComponent(data.productSlug)}`;
  const shopUrl = `${baseUrl}/products?sort=newest`;

  const brandLine = data.productBrand ? ` od ${escapeHtml(data.productBrand)}` : "";
  const sizeLine = data.productSize ? ` (vel. ${escapeHtml(data.productSize)})` : "";
  const priceFormatted = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(data.productPrice);

  const imageBlock = data.productImage
    ? `<a href="${productUrl}" style="display: block; text-decoration: none;">
        <img src="${escapeHtml(data.productImage)}" alt="${escapeHtml(data.productName)}" style="width: 100%; max-width: 400px; height: auto; border-radius: 12px; display: block; margin: 0 auto;" />
      </a>`
    : "";

  return `<!DOCTYPE html>
<html lang="cs">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Second hand móda pro tebe</p>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

      <div style="text-align: center;">
        <div style="width: 64px; height: 64px; background: #fdf4ff; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#128140;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Pořád čeká — ale jenom pro jednu</h2>
        <p style="margin: 0 0 20px; color: #666; font-size: 15px; line-height: 1.6;">
          Prohlížela jsi si <strong style="color: #1a1a1a;">${escapeHtml(data.productName)}</strong>${brandLine}${sizeLine}. Tento kousek je unikát — existuje jen jeden. Kdokoliv ho může koupit dřív než ty.
        </p>
      </div>

      ${imageBlock}

      <div style="text-align: center; margin: 20px 0 8px;">
        <p style="margin: 0; font-size: 22px; font-weight: 700; color: #1a1a1a;">${priceFormatted} Kč</p>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${productUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">
          Koupit teď
        </a>
      </div>

      <div style="text-align: center; margin-top: 16px;">
        <a href="${shopUrl}" style="color: #666; font-size: 13px; text-decoration: underline;">
          Prohlédnout další kousky
        </a>
      </div>

      <p style="margin: 24px 0 0; color: #999; font-size: 12px; text-align: center; line-height: 1.5;">
        Tento email jsi dostala, protože jsi prohlížela náš eshop. Každý kousek je unikát — chceme, abys nepřišla o ten svůj.
      </p>
    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
      <p style="margin: 4px 0 0;">
        <a href="${baseUrl}/api/unsubscribe/browse-abandonment?token=${encodeURIComponent(signUnsubscribeToken(data.email))}" style="color: #999; text-decoration: underline;">Odhlásit se z odběru</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send a browse abandonment email — single email per viewed product.
 * Authentic scarcity: each second-hand item genuinely exists only once.
 * Subject line names the specific product for maximum open rate.
 */
export async function sendBrowseAbandonmentEmail(
  data: BrowseAbandonmentEmailData,
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping browse abandonment email");
    return false;
  }

  const brandPart = data.productBrand ? ` ${data.productBrand}` : "";
  const sizePart = data.productSize ? ` vel. ${data.productSize}` : "";
  const subject = `Ještě tam je —${brandPart} ${data.productName}${sizePart} — Janička Shop`;

  try {
    await resend.emails.send({
      from: NEWSLETTER_FROM_EMAIL,
      to: data.email,
      subject,
      html: buildBrowseAbandonmentHtml(data),
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send browse abandonment email to ${data.email}:`, error);
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

function buildCrossSellFollowUpHtml(data: CrossSellFollowUpData): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  const crossSellHtml = buildCrossSellProductsHtml(data.products);

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
        <div style="width: 64px; height: 64px; background: #fce7f3; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 32px; line-height: 64px;">&#128149;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Nov&eacute; kousky ve tv&eacute;m stylu</h2>
        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
          ${escapeHtml(data.customerName)}, od tv&eacute;ho posledn&iacute;ho n&aacute;kupu p&rcaron;ibyly nov&eacute; kousky,
          kter&eacute; by se ti mohly l&iacute;bit.
        </p>
      </div>

      ${crossSellHtml}

      <div style="text-align: center; margin-top: 24px;">
        <a href="${baseUrl}/products?sort=newest" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Prohl&eacute;dnout v&scaron;echny novinky
        </a>
      </div>

    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Jani&ccaron;ka Shop &mdash; Second hand m&oacute;da</p>
      <p style="margin: 8px 0 0;">
        <a href="${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(data.customerEmail))}" style="color: #999; text-decoration: underline;">Odhl&aacute;sit se z odb&ecaron;ru</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send cross-sell follow-up email 14 days after purchase.
 * Shows 3 live products from same category + size as purchased items.
 * Subject leads with discovery framing — no discount language.
 */
export async function sendCrossSellFollowUpEmail(
  data: CrossSellFollowUpData,
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping cross-sell follow-up email");
    return false;
  }

  try {
    await resend.emails.send({
      from: NEWSLETTER_FROM_EMAIL,
      to: data.customerEmail,
      subject: "Nové kousky ve tvém stylu \u{1F495} — Janička Shop",
      html: buildCrossSellFollowUpHtml(data),
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send cross-sell follow-up to ${data.customerEmail}:`, error);
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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  const productsHtml = buildCrossSellProductsHtml(data.products);

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
          <span style="font-size: 32px; line-height: 64px;">&#128075;</span>
        </div>
        <h2 style="margin: 0 0 8px; font-size: 20px; color: #1a1a1a;">Chyb&iacute;&scaron; n&aacute;m!</h2>
        <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
          ${escapeHtml(data.customerName)}, u&zcaron; je to chv&iacute;li, co jsi u n&aacute;s nakupovala.
          Mezit&iacute;m p&rcaron;ibyly nov&eacute; unik&aacute;tn&iacute; kousky &mdash; ka&zcaron;d&yacute; jen jeden.
        </p>
      </div>

      ${productsHtml}

      <div style="text-align: center; margin-top: 24px;">
        <a href="${baseUrl}/products?sort=newest" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Prohl&eacute;dnout novinky
        </a>
      </div>

    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Jani&ccaron;ka Shop &mdash; Second hand m&oacute;da</p>
      <p style="margin: 8px 0 0;">
        <a href="${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(data.customerEmail))}" style="color: #999; text-decoration: underline;">Odhl&aacute;sit se z odb&ecaron;ru</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send win-back email to customers who haven't ordered in 30+ days.
 * Shows fresh products to re-engage lapsed customers.
 */
export async function sendWinBackEmail(
  data: WinBackEmailData,
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping win-back email");
    return false;
  }

  try {
    await resend.emails.send({
      from: NEWSLETTER_FROM_EMAIL,
      to: data.customerEmail,
      subject: "Nové kousky čekají \u{1F44B} — Janička Shop",
      html: buildWinBackHtml(data),
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send win-back email to ${data.customerEmail}:`, error);
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

function buildCampaignProductGridHtml(products: CampaignProduct[]): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  // 2-column grid using nested tables for email client compatibility
  const cells = products.map((p) => {
    const productUrl = `${baseUrl}/products/${p.slug}`;
    const imageHtml = p.image
      ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; border: 1px solid #f0f0f0;" />`
      : `<div style="width: 100%; height: 200px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><span style="font-size: 32px;">&#128087;</span></div>`;

    const discount = p.compareAt && p.compareAt > p.price
      ? Math.round(((p.compareAt - p.price) / p.compareAt) * 100)
      : null;

    const priceHtml = discount
      ? `<span style="text-decoration: line-through; color: #999; font-size: 12px;">${formatPriceCzk(p.compareAt!)}</span><br/><strong style="color: #dc2626;">${formatPriceCzk(p.price)}</strong> <span style="background: #dc2626; color: #fff; font-size: 11px; padding: 1px 5px; border-radius: 4px;">-${discount}%</span>`
      : `<strong style="color: #1a1a1a;">${formatPriceCzk(p.price)}</strong>`;

    const conditionLabel = CONDITION_LABELS_EMAIL[p.condition] ?? p.condition;

    return `
      <td style="width: 50%; padding: 8px; vertical-align: top;">
        <a href="${productUrl}" style="text-decoration: none; color: inherit; display: block;">
          ${imageHtml}
          <p style="margin: 8px 0 2px; font-size: 13px; font-weight: 600; color: #1a1a1a; line-height: 1.3;">${escapeHtml(p.name)}</p>
          ${p.brand ? `<p style="margin: 0 0 2px; font-size: 12px; color: #888;">${escapeHtml(p.brand)}</p>` : ""}
          <p style="margin: 0 0 4px; font-size: 11px; color: #666;">${escapeHtml(conditionLabel)}</p>
          <div>${priceHtml}</div>
        </a>
      </td>`;
  });

  // Pair cells into rows of 2
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    const cell2 = cells[i + 1] ?? '<td style="width: 50%; padding: 8px;"></td>';
    rows.push(`<tr>${cells[i]}${cell2}</tr>`);
  }

  return `<table style="width: 100%; border-collapse: collapse; margin-top: 16px;">${rows.join("")}</table>`;
}

function buildCampaignHtml(data: CampaignEmailData, recipientEmail: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const unsubscribeUrl = `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}`;

  const productsHtml = data.products.length > 0
    ? buildCampaignProductGridHtml(data.products)
    : "";

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  ${data.previewText ? `<span style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escapeHtml(data.previewText)}</span>` : ""}
</head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Second hand móda pro tebe</p>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

      <div style="text-align: center;">
        <h2 style="margin: 0 0 12px; font-size: 22px; color: #1a1a1a;">${escapeHtml(data.heading)}</h2>
        <div style="color: #555; font-size: 15px; line-height: 1.6;">
          ${data.bodyHtml}
        </div>
      </div>

      ${productsHtml}

      <div style="text-align: center; margin-top: 28px;">
        <a href="${escapeHtml(data.ctaUrl)}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">
          ${escapeHtml(data.ctaText)}
        </a>
      </div>

    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
      <p style="margin: 8px 0 0;">
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Odhlásit se z odběru</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Send a single campaign email to one recipient.
 * Returns true on success, false on failure (non-throwing for batch use).
 */
export async function sendCampaignEmail(
  data: CampaignEmailData,
  recipientEmail: string,
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping campaign email");
    return false;
  }

  try {
    await resend.emails.send({
      from: NEWSLETTER_FROM_EMAIL,
      to: recipientEmail,
      subject: data.subject,
      html: buildCampaignHtml(data, recipientEmail),
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send campaign email to ${recipientEmail}:`, error);
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
// Vinted T&C campaign — April 28, 2026 (C2788 brief)
// ---------------------------------------------------------------------------

export type VintedCampaignSegment = "warm" | "cold";

const VINTED_SUBJECTS: Record<VintedCampaignSegment, string> = {
  warm: "Tvoje fotky patří tobě. Vždy.",
  cold: "Zatímco Vinted školí AI na tvých fotkách...",
};

const VINTED_PREVIEW_TEXT = "U nás je to jinak. A vždy bylo.";

function buildVintedCampaignHtml(
  segment: VintedCampaignSegment,
  recipientEmail: string,
): string {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const unsubscribeUrl = `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}`;
  const shopUrl = `${baseUrl}/products?sort=newest`;

  const isWarm = segment === "warm";

  const headingHtml = isWarm
    ? `Tvoje fotky jsou tvoje.<br/>A vždy budou.`
    : `Víš, co se děje s&nbsp;tvými fotkami na Vintedu?`;

  const bodyHtml = isWarm
    ? `
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
        Ahoj,
      </p>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
        možná jsi zaznamenala, co se děje kolem nás. Vinted od <strong style="color: #1a1a1a;">30.&nbsp;dubna</strong> automaticky
        získává právo používat fotky a&nbsp;inzeráty svých uživatelek k&nbsp;trénování AI&nbsp;modelů.
        Bez možnosti odhlášení. Celosvětově. Trvale.
      </p>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
        U&nbsp;nás je to jinak. <strong style="color: #1a1a1a;">A vždy bylo.</strong>
      </p>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
        Tvoje fotky nikdy nepoužijeme k&nbsp;trénování AI. Žádné skryté klauzule,
        žádné drobné písmo, žádné překvapení. Každý kousek u&nbsp;nás osobně vybíráme,
        fotíme a&nbsp;popisujeme&nbsp;— a&nbsp;tvoje data zůstávají tvoje.
      </p>
    `
    : `
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
        Ahoj,
      </p>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
        od <strong style="color: #1a1a1a;">30.&nbsp;dubna 2026</strong> Vinted automaticky získává
        <em>„celosvětovou, bezúplatnou, trvalou licenci"</em> na fotky a&nbsp;inzeráty
        svých uživatelek&nbsp;— k&nbsp;trénování AI modelů. Opt-out v&nbsp;nastavení pokrývá
        jen marketing. <strong style="color: #1a1a1a;">Trénování AI nelze odmítnout.</strong>
      </p>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
        U&nbsp;Janičky je to jinak. A&nbsp;vždy bylo.
      </p>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444;">
        Tvoje fotky nikdy nepoužijeme k&nbsp;trénování AI. Žádné skryté klauzule,
        žádné drobné písmo. Každý kousek osobně kontrolujeme&nbsp;— a&nbsp;tvoje soukromí
        je pro nás svaté.
      </p>
    `;

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <span style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escapeHtml(VINTED_PREVIEW_TEXT)}</span>
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Second hand móda pro tebe</p>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #fdf4ff; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px;">🛡️</div>
      </div>

      <h2 style="margin: 0 0 20px; font-size: 24px; color: #1a1a1a; text-align: center; line-height: 1.3;">
        ${headingHtml}
      </h2>

      ${bodyHtml}

      <table style="width: 100%; border-collapse: collapse; margin: 24px 0; border-radius: 8px; overflow: hidden;">
        <tr>
          <td style="width: 50%; padding: 16px; background: #fef2f2; vertical-align: top;">
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Vinted</p>
            <p style="margin: 0; font-size: 13px; color: #7f1d1d; line-height: 1.5;">
              Tvoje fotky trénují AI.<br/>Bez možnosti odmítnutí.<br/>Trvale. Celosvětově.
            </p>
          </td>
          <td style="width: 50%; padding: 16px; background: #f0fdf4; vertical-align: top;">
            <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Janička</p>
            <p style="margin: 0; font-size: 13px; color: #14532d; line-height: 1.5;">
              Tvoje fotky jsou tvoje.<br/>Žádné AI trénování.<br/>Nikdy. Tečka.
            </p>
          </td>
        </tr>
      </table>

      <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #666; text-align: center;">
        Podívej se na nové kousky&nbsp;— každý osobně vybraný, vyfocený a&nbsp;popsaný.
      </p>

      <div style="text-align: center;">
        <a href="${shopUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">
          Prohlédnout nové kousky
        </a>
      </div>

    </div>

    <div style="text-align: center; padding: 24px 0; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
      <p style="margin: 8px 0 0;">
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Odhlásit se z odběru</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Render the Vinted T&C campaign email (subject + HTML) without sending.
 * Used by admin dry-run / preview UI before committing a full send.
 */
export function renderVintedCampaignPreview(
  segment: VintedCampaignSegment,
  recipientEmail: string,
): { subject: string; html: string; previewText: string } {
  return {
    subject: VINTED_SUBJECTS[segment],
    html: buildVintedCampaignHtml(segment, recipientEmail),
    previewText: VINTED_PREVIEW_TEXT,
  };
}

/**
 * Send the Vinted T&C campaign email to one recipient.
 * Returns true on success, false on failure (non-throwing for batch use).
 */
export async function sendVintedCampaignEmail(
  segment: VintedCampaignSegment,
  recipientEmail: string,
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping Vinted campaign");
    return false;
  }

  try {
    await resend.emails.send({
      from: NEWSLETTER_FROM_EMAIL,
      to: recipientEmail,
      subject: VINTED_SUBJECTS[segment],
      html: buildVintedCampaignHtml(segment, recipientEmail),
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send Vinted campaign to ${recipientEmail}:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Den matek 2026 — 3-email Resend campaign (Task #103)
// ---------------------------------------------------------------------------

export type MothersDayEmailNumber = 1 | 2 | 3;
export type MothersDaySegment = "warm" | "cold";

const MOTHERS_DAY_SUBJECTS: Record<MothersDayEmailNumber, Record<MothersDaySegment, string>> = {
  1: {
    warm: "Najdi mámě kousek, který nemá nikdo jiný 🌷",
    cold: "Daruj originál místo masové výroby — každý kousek unikát",
  },
  2: {
    warm: "Mámě zbývá pár dní — co ji opravdu potěší?",
    cold: "Mámě zbývá pár dní — co ji opravdu potěší?",
  },
  3: {
    warm: "Poslední šance: odeslání do 3 dnů 📦",
    cold: "Poslední šance: odeslání do 3 dnů 📦",
  },
};

const MOTHERS_DAY_PREVIEWS: Record<MothersDayEmailNumber, string> = {
  1: "U Janičky víš, co kupuješ.",
  2: "Každý kousek je unikát — kdokoliv ho může koupit dřív.",
  3: "Doprava zdarma nad 1 500 Kč. Stihni to pro mámu.",
};

function buildMothersDayProductGridHtml(
  products: CampaignProduct[],
  columns: 2 | 3 = 2,
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  const cells = products.map((p) => {
    const productUrl = `${baseUrl}/products/${p.slug}`;
    const imageHtml = p.image
      ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; border: 1px solid #f0f0f0;" />`
      : `<div style="width: 100%; height: 200px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><span style="font-size: 32px;">👗</span></div>`;

    const discount = p.compareAt && p.compareAt > p.price
      ? Math.round(((p.compareAt - p.price) / p.compareAt) * 100)
      : null;

    const priceHtml = discount
      ? `<span style="text-decoration: line-through; color: #999; font-size: 12px;">${formatPriceCzk(p.compareAt!)}</span><br/><strong style="color: #dc2626;">${formatPriceCzk(p.price)}</strong> <span style="background: #dc2626; color: #fff; font-size: 11px; padding: 1px 5px; border-radius: 4px;">-${discount}%</span>`
      : `<strong style="color: #1a1a1a;">${formatPriceCzk(p.price)}</strong>`;

    const conditionLabel = CONDITION_LABELS_EMAIL[p.condition] ?? p.condition;
    const width = columns === 3 ? "33.33%" : "50%";

    return `
      <td style="width: ${width}; padding: 8px; vertical-align: top;">
        <a href="${productUrl}" style="text-decoration: none; color: inherit; display: block;">
          ${imageHtml}
          <p style="margin: 8px 0 2px; font-size: 13px; font-weight: 600; color: #1a1a1a; line-height: 1.3;">${escapeHtml(p.name)}</p>
          ${p.brand ? `<p style="margin: 0 0 2px; font-size: 12px; color: #888;">${escapeHtml(p.brand)}</p>` : ""}
          <p style="margin: 0 0 2px; font-size: 11px; color: #666;">${escapeHtml(conditionLabel)}</p>
          <p style="margin: 0; font-size: 11px; color: #d946ef;">Unikát — pouze 1 ks</p>
          <div style="margin-top: 4px;">${priceHtml}</div>
        </a>
      </td>`;
  });

  const colCount = columns;
  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += colCount) {
    const rowCells = cells.slice(i, i + colCount);
    while (rowCells.length < colCount) {
      const w = colCount === 3 ? "33.33%" : "50%";
      rowCells.push(`<td style="width: ${w}; padding: 8px;"></td>`);
    }
    rows.push(`<tr>${rowCells.join("")}</tr>`);
  }

  return `<table style="width: 100%; border-collapse: collapse; margin-top: 16px;">${rows.join("")}</table>`;
}

function buildMothersDayEmailShell(
  previewText: string,
  recipientEmail: string,
  innerHtml: string,
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const unsubscribeUrl = `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}`;

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin: 0; padding: 0; background-color: #fdf4ff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <span style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escapeHtml(previewText)}</span>
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Second hand móda pro tebe</p>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      ${innerHtml}
    </div>

    <div style="text-align: center; padding: 20px 0 4px;">
      <p style="margin: 0; font-size: 12px; color: #a855f7; font-style: italic;">Tvoje fotky jsou tvoje. Vždy.</p>
    </div>

    <div style="text-align: center; padding: 4px 0 24px; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
      <p style="margin: 8px 0 0;">
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Odhlásit se z odběru</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// --- Email 1: Warmup (May 1) ---

function buildMothersDayEmail1Html(
  products: CampaignProduct[],
  recipientEmail: string,
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const ctaUrl = `${baseUrl}/products?sort=newest`;

  const productsHtml = products.length > 0
    ? buildMothersDayProductGridHtml(products, 2)
    : "";

  const personaGridHtml = `
    <table style="width: 100%; border-collapse: collapse; margin: 24px 0 8px;">
      <tr>
        <td style="width: 33.33%; padding: 8px; vertical-align: top; text-align: center;">
          <div style="background: #fdf4ff; border-radius: 12px; padding: 16px 8px;">
            <div style="font-size: 28px; margin-bottom: 6px;">🤍</div>
            <p style="margin: 0; font-size: 13px; font-weight: 600; color: #1a1a1a;">Minimalistka</p>
            <p style="margin: 4px 0 0; font-size: 11px; color: #666; line-height: 1.4;">Čisté linie, nadčasové kousky</p>
          </div>
        </td>
        <td style="width: 33.33%; padding: 8px; vertical-align: top; text-align: center;">
          <div style="background: #fef3c7; border-radius: 12px; padding: 16px 8px;">
            <div style="font-size: 28px; margin-bottom: 6px;">✨</div>
            <p style="margin: 0; font-size: 13px; font-weight: 600; color: #1a1a1a;">Klasička</p>
            <p style="margin: 4px 0 0; font-size: 11px; color: #666; line-height: 1.4;">Elegance a ověřená kvalita</p>
          </div>
        </td>
        <td style="width: 33.33%; padding: 8px; vertical-align: top; text-align: center;">
          <div style="background: #f0fdf4; border-radius: 12px; padding: 16px 8px;">
            <div style="font-size: 28px; margin-bottom: 6px;">🌿</div>
            <p style="margin: 0; font-size: 13px; font-weight: 600; color: #1a1a1a;">Boho</p>
            <p style="margin: 4px 0 0; font-size: 11px; color: #666; line-height: 1.4;">Volnost, barvy, originalita</p>
          </div>
        </td>
      </tr>
    </table>
    <p style="margin: 0; text-align: center; font-size: 12px; color: #888;">Jaká je tvoje máma? Najdi jí kousek na míru.</p>
  `;

  const innerHtml = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="display: inline-block; font-size: 40px;">🌷</div>
    </div>

    <h2 style="margin: 0 0 16px; font-size: 24px; color: #1a1a1a; text-align: center; line-height: 1.3;">
      Daruj mámě kousek,<br/>který nemá nikdo jiný
    </h2>

    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444; text-align: center;">
      Den matek je <strong style="color: #1a1a1a;">10.&nbsp;května</strong>.
      Místo masově vyráběných dárků jí dej něco, co má příběh&nbsp;— originální kousek,
      pečlivě vybraný a&nbsp;zkontrolovaný.
    </p>

    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #444; text-align: center;">
      Každý kus u&nbsp;nás existuje jen jednou. Žádné kopie, žádné série.
      Až ho máma rozbalí, bude vědět, že jsi vybírala opravdu jen pro ni.
    </p>

    ${personaGridHtml}

    ${productsHtml}

    <div style="text-align: center; margin-top: 28px;">
      <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; background: #a855f7; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">
        Prohlédnout dárky pro mámu
      </a>
    </div>
  `;

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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const ctaUrl = `${baseUrl}/products?sort=newest`;

  const productsHtml = products.length > 0
    ? buildMothersDayProductGridHtml(products, 2)
    : "";

  const innerHtml = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="display: inline-block; font-size: 40px;">💐</div>
    </div>

    <h2 style="margin: 0 0 16px; font-size: 24px; color: #1a1a1a; text-align: center; line-height: 1.3;">
      Mámě zbývá pár dní.<br/>Co ji opravdu potěší?
    </h2>

    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444; text-align: center;">
      Den matek je už za <strong style="color: #1a1a1a;">3&nbsp;dny</strong>.
      Kytka zvadne, bonboniéra se sní&nbsp;— ale krásný kousek oblečení
      ji potěší pokaždé, když si ho oblékne.
    </p>

    <div style="background: #fdf4ff; border-radius: 8px; padding: 12px 16px; margin: 0 0 20px; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #7e22ce; font-weight: 600;">
        ⚡ Každý kousek existuje jen jednou — kdokoliv ho může koupit dřív
      </p>
    </div>

    ${productsHtml}

    <div style="text-align: center; margin-top: 28px;">
      <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; background: #a855f7; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">
        Vybrat dárek pro mámu
      </a>
    </div>

    <p style="margin: 20px 0 0; font-size: 13px; color: #888; text-align: center; line-height: 1.5;">
      💡 Tip: Nevíš velikost? Dárková poukázka je vždy jistota.
    </p>
  `;

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
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const ctaUrl = `${baseUrl}/products?sort=newest`;

  const productsHtml = products.length > 0
    ? buildMothersDayProductGridHtml(products.slice(0, 3), 3)
    : "";

  const innerHtml = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="display: inline-block; font-size: 40px;">⏰</div>
    </div>

    <h2 style="margin: 0 0 16px; font-size: 24px; color: #1a1a1a; text-align: center; line-height: 1.3;">
      Poslední šance — Den matek je zítra!
    </h2>

    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444; text-align: center;">
      Objednávky zadané <strong style="color: #1a1a1a;">dnes</strong> stihneme odeslat
      tak, aby dorazily včas. Nenechávej to na poslední chvíli.
    </p>

    <div style="background: #f0fdf4; border-radius: 8px; padding: 12px 16px; margin: 0 0 8px; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: #166534; font-weight: 600;">
        🚚 Doprava zdarma nad 1 500 Kč
      </p>
    </div>

    <div style="background: #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 0 0 20px; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600;">
        ⚡ Objednej dnes — stihneme odeslat do 3 dnů
      </p>
    </div>

    ${productsHtml}

    <div style="text-align: center; margin-top: 28px;">
      <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; background: #dc2626; color: #fff; padding: 16px 36px; border-radius: 8px; text-decoration: none; font-size: 16px; font-weight: 700;">
        Objednat teď →
      </a>
    </div>
  `;

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
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping Mother's Day campaign");
    return false;
  }

  try {
    await resend.emails.send({
      from: NEWSLETTER_FROM_EMAIL,
      to: recipientEmail,
      subject: MOTHERS_DAY_SUBJECTS[emailNumber][segment],
      html: MOTHERS_DAY_BUILDERS[emailNumber](products, recipientEmail),
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send Mother's Day email ${emailNumber} to ${recipientEmail}:`, error);
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

function buildCustomsProductGridHtml(products: CampaignProduct[]): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";

  const cells = products.map((p) => {
    const productUrl = `${baseUrl}/products/${p.slug}`;
    const imageHtml = p.image
      ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px; border: 1px solid #f0f0f0;" />`
      : `<div style="width: 100%; height: 180px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><span style="font-size: 32px;">👗</span></div>`;

    const discount = p.compareAt && p.compareAt > p.price
      ? Math.round(((p.compareAt - p.price) / p.compareAt) * 100)
      : null;

    const priceHtml = discount
      ? `<span style="text-decoration: line-through; color: #999; font-size: 12px;">${formatPriceCzk(p.compareAt!)}</span><br/><strong style="color: #dc2626;">${formatPriceCzk(p.price)}</strong> <span style="background: #dc2626; color: #fff; font-size: 11px; padding: 1px 5px; border-radius: 4px;">-${discount}%</span>`
      : `<strong style="color: #1a1a1a;">${formatPriceCzk(p.price)}</strong>`;

    const conditionLabel = CONDITION_LABELS_EMAIL[p.condition] ?? p.condition;

    return `
      <td style="width: 50%; padding: 8px; vertical-align: top;">
        <a href="${productUrl}" style="text-decoration: none; color: inherit; display: block;">
          ${imageHtml}
          <p style="margin: 8px 0 2px; font-size: 13px; font-weight: 600; color: #1a1a1a; line-height: 1.3;">${escapeHtml(p.name)}</p>
          ${p.brand ? `<p style="margin: 0 0 2px; font-size: 12px; color: #888;">${escapeHtml(p.brand)}</p>` : ""}
          <p style="margin: 0 0 2px; font-size: 11px; color: #666;">${escapeHtml(conditionLabel)}</p>
          <p style="margin: 0; font-size: 11px; color: #16a34a;">Bez cla — domácí zboží</p>
          <div style="margin-top: 4px;">${priceHtml}</div>
        </a>
      </td>`;
  });

  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    const cell2 = cells[i + 1] ?? '<td style="width: 50%; padding: 8px;"></td>';
    rows.push(`<tr>${cells[i]}${cell2}</tr>`);
  }

  return `<table style="width: 100%; border-collapse: collapse; margin-top: 16px;">${rows.join("")}</table>`;
}

function buildCustomsEmailShell(
  previewText: string,
  recipientEmail: string,
  innerHtml: string,
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const unsubscribeUrl = `${baseUrl}/odhlasit-novinky?token=${encodeURIComponent(signUnsubscribeToken(recipientEmail))}`;

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <span style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escapeHtml(previewText)}</span>
</head>
<body style="margin: 0; padding: 0; background-color: #f0fdf4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">

    <div style="text-align: center; padding: 24px 0;">
      <a href="${baseUrl}" style="display: inline-block;"><img src="${baseUrl}/logo/logo-email.png" alt="Janička Shop" style="height: 40px; width: auto; border: 0;" /></a>
      <p style="margin: 4px 0 0; font-size: 13px; color: #999;">Second hand móda pro tebe</p>
    </div>

    <div style="background: #fff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
      ${innerHtml}
    </div>

    <div style="text-align: center; padding: 20px 0 4px;">
      <p style="margin: 0; font-size: 12px; color: #16a34a; font-style: italic;">Nakupuj lokálně — bez cel, bez překvapení.</p>
    </div>

    <div style="text-align: center; padding: 4px 0 24px; font-size: 12px; color: #999;">
      <p style="margin: 0;">Janička Shop — Second hand móda</p>
      <p style="margin: 8px 0 0;">
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Odhlásit se z odběru</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// --- Email 1: Soft tease (June 15) ---

function buildCustomsEmail1Html(
  products: CampaignProduct[],
  recipientEmail: string,
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const infoUrl = `${baseUrl}/nakupuj-cesky`;
  const shopUrl = `${baseUrl}/products?sort=newest`;

  const productsHtml = products.length > 0
    ? buildCustomsProductGridHtml(products)
    : "";

  const innerHtml = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="display: inline-block; font-size: 40px;">🇨🇿</div>
    </div>

    <h2 style="margin: 0 0 16px; font-size: 22px; color: #1a1a1a; text-align: center; line-height: 1.3;">
      Chytré nakupování léto 2026
    </h2>

    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444; text-align: center;">
      Věděla jsi, že od <strong style="color: #1a1a1a;">1.&nbsp;července 2026</strong>
      se mění pravidla dovozu do EU? Zásilky ze zahraničí
      (Shein, Temu, Aliexpress) budou nově podléhat clu — minimálně
      <strong style="color: #1a1a1a;">75&nbsp;Kč navíc</strong> za každou kategorii zboží.
    </p>

    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #444; text-align: center;">
      U&nbsp;Janičky se nic nemění. Jsme český eshop — žádná cla,
      žádné čekání na celnici, žádná překvapení.
    </p>

    <table style="width: 100%; border-collapse: collapse; margin: 24px 0; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="width: 50%; padding: 16px; background: #fef2f2; vertical-align: top;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">Ze zahraničí</p>
          <p style="margin: 0; font-size: 13px; color: #7f1d1d; line-height: 1.5;">
            Cena + clo + DPH.<br/>2–6 týdnů čekání.<br/>Kvalita nejistá.
          </p>
        </td>
        <td style="width: 50%; padding: 16px; background: #f0fdf4; vertical-align: top;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Janička</p>
          <p style="margin: 0; font-size: 13px; color: #14532d; line-height: 1.5;">
            Cena = finální cena.<br/>Doručení do 3 dnů.<br/>Ověřená kvalita.
          </p>
        </td>
      </tr>
    </table>

    ${productsHtml}

    <div style="text-align: center; margin-top: 28px; margin-bottom: 12px;">
      <a href="${infoUrl}" style="display: inline-block; background: #1a1a1a; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">
        Zjistit víc o&nbsp;změnách
      </a>
    </div>

    <div style="text-align: center;">
      <a href="${shopUrl}" style="color: #666; font-size: 13px; text-decoration: underline;">
        Nebo se rovnou podívej na nové kousky →
      </a>
    </div>
  `;

  return buildCustomsEmailShell(CUSTOMS_PREVIEWS[1], recipientEmail, innerHtml);
}

// --- Email 2: Final push (June 28) ---

function buildCustomsEmail2Html(
  products: CampaignProduct[],
  recipientEmail: string,
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const shopUrl = `${baseUrl}/products?sort=newest`;
  const infoUrl = `${baseUrl}/nakupuj-cesky`;

  const productsHtml = products.length > 0
    ? buildCustomsProductGridHtml(products)
    : "";

  const innerHtml = `
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="display: inline-block; font-size: 40px;">📦</div>
    </div>

    <h2 style="margin: 0 0 16px; font-size: 22px; color: #1a1a1a; text-align: center; line-height: 1.3;">
      Za 3 dny se mění pravidla dovozu
    </h2>

    <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.7; color: #444; text-align: center;">
      Od <strong style="color: #1a1a1a;">1.&nbsp;července</strong> platí nová cla
      na všechny zásilky ze zahraničí pod 150&nbsp;€. Oblečení z&nbsp;Číny
      zdraží o&nbsp;15–50&nbsp;%.
    </p>

    <div style="background: #fefce8; border-radius: 8px; padding: 16px; margin: 0 0 20px; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: #854d0e; line-height: 1.5;">
        <strong>Šaty z&nbsp;Aliexpresu za 400&nbsp;Kč?</strong><br/>
        Od července + 75&nbsp;Kč clo + týdny čekání.<br/>
        U&nbsp;Janičky: kvalitní šaty od <strong>350&nbsp;Kč</strong>,
        doručení do 3&nbsp;dnů, <strong>žádné clo</strong>.
      </p>
    </div>

    <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.7; color: #444; text-align: center;">
      Nakupuj chytře — lokálně, bez poplatků navíc.
      Každý kousek u&nbsp;nás je unikát, pečlivě zkontrolovaný
      a&nbsp;vyfocený. Víš přesně, co dostaneš.
    </p>

    ${productsHtml}

    <div style="text-align: center; margin-top: 28px; margin-bottom: 12px;">
      <a href="${shopUrl}" style="display: inline-block; background: #16a34a; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">
        Prohlédnout nabídku
      </a>
    </div>

    <div style="text-align: center;">
      <a href="${infoUrl}" style="color: #666; font-size: 13px; text-decoration: underline;">
        Přečíst si víc o&nbsp;změnách →
      </a>
    </div>
  `;

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
  const resend = getResendClient();
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping customs campaign");
    return false;
  }

  try {
    await resend.emails.send({
      from: NEWSLETTER_FROM_EMAIL,
      to: recipientEmail,
      subject: CUSTOMS_SUBJECTS[emailNumber],
      html: CUSTOMS_BUILDERS[emailNumber](products, recipientEmail),
    });
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send customs email ${emailNumber} to ${recipientEmail}:`, error);
    return false;
  }
}
