/**
 * Packeta/Zásilkovna SOAP API client.
 *
 * Packeta's packet creation API is SOAP-only (REST v5 is for pickup-point queries only).
 * Endpoint: https://www.zasilkovna.cz/api/soap (WSDL: ?wsdl)
 *
 * Functions:
 *  - createPacket(data) → packetId
 *  - getPacketLabel(packetId) → base64 PDF (A6 on A4)
 *  - getPacketStatus(packetId) → { codeText, storedUntil, isReturning }
 *  - cancelPacket(packetId) → void
 */

import * as soap from "soap";

const PACKETA_WSDL = "https://www.zasilkovna.cz/api/soap?wsdl";

function getApiPassword(): string {
  const pw = process.env.PACKETA_API_PASSWORD;
  if (!pw) throw new Error("PACKETA_API_PASSWORD is not set");
  return pw;
}

let clientPromise: ReturnType<typeof soap.createClientAsync> | null = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = soap.createClientAsync(PACKETA_WSDL);
  }
  return clientPromise;
}

// ── Types ──

export interface CreatePacketInput {
  /** Order number (unique identifier in our system) */
  number: string;
  /** Recipient first name */
  name: string;
  /** Recipient last name */
  surname: string;
  /** Recipient email (optional) */
  email?: string;
  /** Recipient phone (optional) */
  phone?: string;
  /** Package value in CZK */
  value: number;
  /** Package weight in kg (min 0.001, default 0.5 for clothing) */
  weight?: number;
  /** Packeta pickup point ID (numeric string from widget) */
  addressId: string;
  /** Sender label displayed on the package */
  eshop: string;
  /** Cash on delivery amount (optional) */
  cod?: number;
  /** Currency code (default CZK) */
  currency?: string;
}

export interface PacketStatusResult {
  codeText: string;
  storedUntil: string | null;
  isReturning: boolean;
}

// ── API Functions ──

/**
 * Create a new packet (shipment) in Packeta system.
 * Returns the numeric packetId used for all subsequent operations.
 */
export async function createPacket(input: CreatePacketInput): Promise<string> {
  const client = await getClient();
  const apiPassword = getApiPassword();

  const weight = input.weight ?? 0.5;
  if (weight <= 0) {
    throw new Error("Hmotnost zásilky musí být větší než 0 kg");
  }

  const attrs: Record<string, unknown> = {
    number: input.number,
    name: input.name,
    surname: input.surname,
    value: input.value.toFixed(2),
    weight: weight.toFixed(3),
    addressId: input.addressId,
    eshop: input.eshop,
    currency: input.currency ?? "CZK",
  };

  if (input.email) attrs.email = input.email;
  if (input.phone) attrs.phone = input.phone;
  if (input.cod !== undefined && input.cod > 0) {
    attrs.cod = input.cod.toFixed(2);
  }

  const [result] = await client.createPacketAsync({
    apiPassword,
    packetAttributes: attrs,
  });

  // Packeta returns result.id on success, or result.fault on error
  if (result?.fault) {
    const faultMsg =
      result.fault.string ?? result.fault.detail ?? JSON.stringify(result.fault);
    throw new Error(`Packeta chyba: ${faultMsg}`);
  }

  const packetId = result?.id;
  if (!packetId) {
    throw new Error("Packeta nevrátila ID zásilky");
  }

  return String(packetId);
}

/**
 * Get a shipping label PDF for one or more packets.
 * Returns base64-encoded PDF (A6 on A4 format).
 */
export async function getPacketLabel(packetId: string): Promise<string> {
  const client = await getClient();
  const apiPassword = getApiPassword();

  const [result] = await client.packetsLabelsPdfAsync({
    apiPassword,
    packetIds: { id: [packetId] },
    format: "A6 on A4",
    offset: 0,
  });

  if (result?.fault) {
    const faultMsg =
      result.fault.string ?? result.fault.detail ?? JSON.stringify(result.fault);
    throw new Error(`Packeta chyba (štítek): ${faultMsg}`);
  }

  const pdfBase64 = result?.pdf;
  if (!pdfBase64) {
    throw new Error("Packeta nevrátila PDF štítek");
  }

  return pdfBase64;
}

/**
 * Get shipping labels PDF for multiple packets, merged into a single PDF.
 * Returns base64-encoded PDF (A6 on A4 format).
 */
export async function getPacketLabelsBatch(
  packetIds: string[],
): Promise<string> {
  if (packetIds.length === 0) {
    throw new Error("Žádné zásilky k tisku");
  }

  const client = await getClient();
  const apiPassword = getApiPassword();

  const [result] = await client.packetsLabelsPdfAsync({
    apiPassword,
    packetIds: { id: packetIds },
    format: "A6 on A4",
    offset: 0,
  });

  if (result?.fault) {
    const faultMsg =
      result.fault.string ?? result.fault.detail ?? JSON.stringify(result.fault);
    throw new Error(`Packeta chyba (štítky): ${faultMsg}`);
  }

  const pdfBase64 = result?.pdf;
  if (!pdfBase64) {
    throw new Error("Packeta nevrátila PDF štítky");
  }

  return pdfBase64;
}

/**
 * Get current status of a packet.
 */
export async function getPacketStatus(
  packetId: string,
): Promise<PacketStatusResult> {
  const client = await getClient();
  const apiPassword = getApiPassword();

  const [result] = await client.packetStatusAsync({
    apiPassword,
    packetId,
  });

  if (result?.fault) {
    const faultMsg =
      result.fault.string ?? result.fault.detail ?? JSON.stringify(result.fault);
    throw new Error(`Packeta chyba (status): ${faultMsg}`);
  }

  return {
    codeText: result?.codeText ?? "unknown",
    storedUntil: result?.storedUntil ?? null,
    isReturning: result?.isReturning === true || result?.isReturning === "true",
  };
}

/**
 * Cancel a packet that hasn't been picked up yet.
 */
export async function cancelPacket(packetId: string): Promise<void> {
  const client = await getClient();
  const apiPassword = getApiPassword();

  const [result] = await client.cancelPacketAsync({
    apiPassword,
    packetId,
  });

  if (result?.fault) {
    const faultMsg =
      result.fault.string ?? result.fault.detail ?? JSON.stringify(result.fault);
    throw new Error(`Packeta chyba (storno): ${faultMsg}`);
  }
}
