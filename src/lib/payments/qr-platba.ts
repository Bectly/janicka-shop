import spayd from "spayd";
import QRCode from "qrcode";

interface QrPlatbaParams {
  /** Shop IBAN (from env) */
  iban: string;
  /** Amount in CZK */
  amount: number;
  /** Variable symbol — order number digits only */
  variableSymbol: string;
  /** Message for the bank statement */
  message?: string;
  /** Receiver name */
  receiverName?: string;
}

/**
 * Generate a SPAYD string for Czech QR bank transfers.
 * SPAYD (Short Payment Descriptor) is the ČBA standard since 2012,
 * adopted by all Czech banks.
 */
export function generateSpayd(params: QrPlatbaParams): string {
  return spayd({
    acc: params.iban,
    am: params.amount.toFixed(2),
    cc: "CZK",
    xvs: params.variableSymbol,
    msg: params.message,
    rn: params.receiverName,
  });
}

/**
 * Generate a QR code data URL (PNG) from a SPAYD string.
 * Returns a base64-encoded data URL ready for <img src="...">.
 */
export async function generateQrDataUrl(
  spaydString: string,
): Promise<string> {
  return QRCode.toDataURL(spaydString, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 256,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

/**
 * Extract a numeric variable symbol from an order number.
 * Order numbers look like "JN-260403-A1B2C3D4".
 * Variable symbol must be numeric only (max 10 digits).
 * We use the date part + hash of the random part.
 */
export function orderNumberToVariableSymbol(orderNumber: string): string {
  // Extract date (YYMMDD) and random parts from "JN-YYMMDD-XXXXXXXX"
  const parts = orderNumber.split("-");
  const datePart = parts[1] ?? "";
  const randPart = parts[2] ?? "";

  // Convert random alphanumeric part to a numeric hash (simple sum-based)
  let hash = 0;
  for (let i = 0; i < randPart.length; i++) {
    hash = (hash * 31 + randPart.charCodeAt(i)) % 10000;
  }

  // Variable symbol: date (6 digits) + hash (4 digits) = 10 digits max
  return `${datePart}${hash.toString().padStart(4, "0")}`;
}

/**
 * Generate complete QR payment data for an order.
 * Returns null if SHOP_IBAN is not configured.
 */
export async function generateOrderQrPayment(
  orderNumber: string,
  totalCzk: number,
): Promise<{ spaydString: string; qrDataUrl: string } | null> {
  const iban = process.env.SHOP_IBAN;
  if (!iban) return null;

  const variableSymbol = orderNumberToVariableSymbol(orderNumber);
  const spaydString = generateSpayd({
    iban,
    amount: totalCzk,
    variableSymbol,
    message: `Objednavka ${orderNumber}`,
    receiverName: process.env.SHOP_NAME ?? "Janicka",
  });

  const qrDataUrl = await generateQrDataUrl(spaydString);
  return { spaydString, qrDataUrl };
}
