import { NextRequest, NextResponse } from "next/server";

/**
 * Validate feed access token from query parameter.
 *
 * Feed URLs are shared with aggregators (Heureka, Google Merchant, Pinterest)
 * as: /api/feed/heureka?token=<FEED_SECRET>
 *
 * When FEED_SECRET env var is set, requests without a valid token get 403.
 * When FEED_SECRET is NOT set (dev/preview), feeds remain open.
 */
export function validateFeedToken(req: NextRequest): NextResponse | null {
  const secret = process.env.FEED_SECRET;
  if (!secret) return null; // No secret configured — allow open access (dev mode)

  const token = req.nextUrl.searchParams.get("token");
  if (token === secret) return null; // Valid token

  return NextResponse.json(
    { error: "Neplatný přístupový token" },
    { status: 403 },
  );
}
