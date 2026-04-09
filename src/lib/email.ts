import { Resend } from "resend";

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
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Janička Shop</h1>
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
      <p style="margin: 4px 0 0;">Tento email byl odeslán na ${escapeHtml(email)}, protože jste se přihlásili k odběru novinek.</p>
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
}

function buildAdminNewOrderHtml(data: AdminOrderNotificationData): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://janicka-shop.vercel.app";
  const adminUrl = `${baseUrl}/admin/orders`;

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
      <h1 style="margin: 0; font-size: 20px; color: #1a1a1a;">Nová objednávka!</h1>
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

  // Admin email from env, with shop settings contact email as fallback
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) {
    console.warn("[Email] ADMIN_NOTIFICATION_EMAIL not set — skipping admin order notification");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `Nová objednávka ${data.orderNumber} — ${formatPriceCzk(data.total)}`,
      html: buildAdminNewOrderHtml(data),
    });
  } catch (error) {
    console.error(`[Email] Failed to send admin notification for ${data.orderNumber}:`, error);
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
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Janička Shop</h1>
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
        Nechcete dostávat tyto emaily?
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
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Janička Shop</h1>
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
      <p style="margin: 4px 0 0;">Tento email jste obdrželi, protože jste u nás nakoupili.</p>
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
      <h1 style="margin: 0; font-size: 24px; color: #1a1a1a;">Janička Shop</h1>
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
        <a href="${baseUrl}/odhlasit-novinky?email=${encodeURIComponent(data.email)}" style="color: #999; text-decoration: underline;">Odhlásit se z odběru</a>
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
