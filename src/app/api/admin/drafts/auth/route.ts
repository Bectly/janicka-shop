import { NextResponse, type NextRequest } from "next/server";

import { getDb } from "@/lib/db";
import {
  DRAFT_SESSION_COOKIE,
  DRAFT_SESSION_TTL_SECONDS,
  buildDraftSessionCookieValue,
  hashDraftToken,
  verifyDraftQrToken,
} from "@/lib/draft-qr";
import { logger } from "@/lib/logger";

function expiredResponse(reason: string): NextResponse {
  logger.warn("[drafts/auth] rejected:", reason);
  const html = `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Odkaz vypršel</title><style>body{font-family:system-ui,sans-serif;display:flex;min-height:100dvh;align-items:center;justify-content:center;margin:0;padding:1.5rem;background:#fafaf9;color:#1c1917;text-align:center}main{max-width:24rem}h1{margin:0 0 .5rem;font-size:1.5rem}p{margin:0;color:#57534e;font-size:.95rem}</style></head><body><main><h1>Odkaz vypršel</h1><p>Naskenuj prosím znovu QR kód z počítače. Odkaz platí jen 15 minut.</p></main></body></html>`;
  return new NextResponse(html, {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return expiredResponse("missing token");
  }

  let payload;
  try {
    payload = await verifyDraftQrToken(token);
  } catch (err) {
    return expiredResponse(`jwt verify failed: ${(err as Error).message}`);
  }

  const tokenHash = hashDraftToken(token);
  const db = await getDb();
  const batch = await db.productDraftBatch.findUnique({
    where: { id: payload.batchId },
    select: {
      id: true,
      adminId: true,
      tokenHash: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!batch) return expiredResponse("batch not found");
  if (batch.tokenHash !== tokenHash) return expiredResponse("token hash mismatch");
  if (batch.adminId !== payload.adminId) return expiredResponse("admin mismatch");
  if (batch.status !== "open") return expiredResponse(`batch status=${batch.status}`);
  if (batch.expiresAt.getTime() <= Date.now()) return expiredResponse("batch expired");

  const redirectUrl = new URL(`/admin/drafts/${batch.id}/mobile`, request.nextUrl.origin);
  const response = NextResponse.redirect(redirectUrl, { status: 303 });
  response.cookies.set({
    name: DRAFT_SESSION_COOKIE,
    value: buildDraftSessionCookieValue(batch.id, batch.adminId),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DRAFT_SESSION_TTL_SECONDS,
  });

  return response;
}
