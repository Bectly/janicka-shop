import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateMessageSchema = z.object({
  status: z.enum(["new", "read", "resolved"]).optional(),
  response: z.string().max(5000).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

function isLeadAuthorized(request: Request): boolean {
  const apiKey = process.env.DEVCHAT_API_KEY;
  if (!apiKey) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${apiKey}`;
}

/**
 * PATCH /api/dev-chat/[id] — Update a message (status, response).
 * Auth: Admin session OR Lead API key.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const isLead = isLeadAuthorized(request);
  if (!session?.user && !isLead) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = await getDb();

  // Check message exists
  const existing = await db.devChatMessage.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status) data.status = parsed.data.status;
  if (parsed.data.response !== undefined) {
    data.response = parsed.data.response;
    // Auto-resolve when Lead responds (if not explicitly set)
    if (!parsed.data.status) data.status = "resolved";
  }
  if (parsed.data.priority) data.priority = parsed.data.priority;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await db.devChatMessage.update({
    where: { id },
    data,
  });

  return NextResponse.json({ message: updated });
}

/**
 * GET /api/dev-chat/[id] — Get a single message.
 * Auth: Admin session OR Lead API key.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const isLead = isLeadAuthorized(request);
  if (!session?.user && !isLead) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = await getDb();
  const message = await db.devChatMessage.findUnique({ where: { id } });

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  return NextResponse.json({ message });
}
