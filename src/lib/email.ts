import { Resend } from "resend";

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM_EMAIL = process.env.EMAIL_FROM ?? "Janička Shop <objednavky@janicka-shop.cz>";

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
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Janička Shop</h1>
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
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Janička Shop</h1>
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
    .replace(/"/g, "&quot;");
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
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Janička Shop</h1>
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
