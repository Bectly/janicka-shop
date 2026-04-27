import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

const ENC = new TextEncoder();

export const DRAFT_QR_TTL_SECONDS = 15 * 60;
export const DRAFT_SESSION_TTL_SECONDS = 12 * 60 * 60;
export const DRAFT_SESSION_COOKIE = "draft_session";

export interface DraftQrPayload {
  batchId: string;
  adminId: string;
}

function getSecret(): Uint8Array {
  const raw = process.env.DRAFT_QR_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "DRAFT_QR_SECRET env var missing or shorter than 32 bytes — required for QR draft signing"
    );
  }
  return ENC.encode(raw);
}

export async function signDraftQrToken(
  payload: DraftQrPayload,
  ttlSeconds: number = DRAFT_QR_TTL_SECONDS
): Promise<string> {
  return new SignJWT({ batchId: payload.batchId, adminId: payload.adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecret());
}

export async function verifyDraftQrToken(token: string): Promise<DraftQrPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ["HS256"],
  });
  if (typeof payload.batchId !== "string" || typeof payload.adminId !== "string") {
    throw new Error("Malformed QR draft token");
  }
  return { batchId: payload.batchId, adminId: payload.adminId };
}

export function hashDraftToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateDraftSessionId(): string {
  return randomBytes(16).toString("hex");
}

export function buildDraftSessionCookieValue(batchId: string, adminId: string): string {
  return `${batchId}:${adminId}`;
}
