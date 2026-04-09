import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";

const createMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  pagePath: z.string().max(500).optional(),
  pageTitle: z.string().max(200).optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

/**
 * Verify Lead agent API key (Bearer token).
 * Uses DEVCHAT_API_KEY env var.
 */
function isLeadAuthorized(request: Request): boolean {
  const apiKey = process.env.DEVCHAT_API_KEY;
  if (!apiKey) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${apiKey}`;
}

/**
 * Debounce check — reject duplicate messages from same page within 30s.
 */
async function isDuplicate(
  db: Awaited<ReturnType<typeof getDb>>,
  message: string,
  pagePath: string | undefined,
): Promise<boolean> {
  const thirtySecondsAgo = new Date(Date.now() - 30_000);
  const existing = await db.devChatMessage.findFirst({
    where: {
      message,
      pagePath: pagePath ?? null,
      sender: "owner",
      createdAt: { gte: thirtySecondsAgo },
    },
  });
  return !!existing;
}

/**
 * POST /api/dev-chat — Create a new message.
 * Auth: Admin session (owner writing from widget).
 */
export async function POST(request: Request) {
  // Require admin session for posting messages
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { message, pagePath, pageTitle, priority } = parsed.data;

  const db = await getDb();

  // Debounce: same text from same page within 30s
  if (await isDuplicate(db, message, pagePath)) {
    return NextResponse.json(
      { error: "Duplicate message", deduplicated: true },
      { status: 409 },
    );
  }

  const msg = await db.devChatMessage.create({
    data: {
      message,
      pagePath,
      pageTitle,
      sender: "owner",
      priority,
    },
  });

  return NextResponse.json({ id: msg.id, status: "created" }, { status: 201 });
}

/**
 * GET /api/dev-chat — List messages.
 * Auth: Admin session OR Lead API key.
 * Query params: status (new|read|resolved), sender, limit, page.
 */
export async function GET(request: Request) {
  // Allow both admin session and Lead API key
  const session = await auth();
  const isLead = isLeadAuthorized(request);
  if (!session?.user && !isLead) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const sender = url.searchParams.get("sender");
  const limitParam = parseInt(url.searchParams.get("limit") ?? "50");
  const limit = Math.min(Math.max(1, limitParam), 100);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (sender) where.sender = sender;

  const db = await getDb();
  const messages = await db.devChatMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ messages, count: messages.length });
}
