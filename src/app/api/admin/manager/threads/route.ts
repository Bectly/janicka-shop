import { NextResponse, connection } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  JANICKA_PROJECT_ID,
  ThreadBlocksSchema,
  deriveSubject,
  extractText,
  parseBlocks,
  textBlock,
} from "@/lib/manager-thread";

async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * GET /api/admin/manager/threads — list threads for the Janička project,
 * sorted by last activity DESC. Includes unread count (= manager messages
 * with readAt=null).
 */
export async function GET() {
  await connection();
  const guard = await requireAdmin();
  if (guard) return guard;

  const db = await getDb();
  const threads = await db.managerThread.findMany({
    where: { projectId: JANICKA_PROJECT_ID },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      messages: {
        select: { id: true, role: true, readAt: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const rows = threads.map((t) => {
    const unread = t.messages.filter(
      (m) => m.role === "manager" && m.readAt === null,
    ).length;
    const lastMessageAt =
      t.messages.length > 0
        ? t.messages[t.messages.length - 1].createdAt.toISOString()
        : null;
    return {
      id: t.id,
      subject: t.subject,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      messageCount: t.messages.length,
      unreadCount: unread,
      lastMessageAt,
    };
  });

  return NextResponse.json({ threads: rows });
}

const CreateThreadSchema = z.object({
  // Either freeform text (server wraps it as a text block) or pre-built blocks.
  bodyMd: z.string().min(1).max(4000).optional(),
  blocks: ThreadBlocksSchema.optional(),
  imageKeys: z.array(z.string().min(1).max(300)).max(8).optional(),
});

/**
 * POST /api/admin/manager/threads — create a new thread + initial user message.
 * Subject is auto-extracted from the first 80 chars of the message text.
 */
export async function POST(req: Request) {
  await connection();
  const guard = await requireAdmin();
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateThreadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatné parametry", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const blocks =
    parsed.data.blocks ??
    (parsed.data.bodyMd ? [textBlock(parsed.data.bodyMd)] : null);
  if (!blocks || blocks.length === 0) {
    return NextResponse.json(
      { error: "Zpráva musí obsahovat text nebo bloky" },
      { status: 400 },
    );
  }
  const text = extractText(blocks);
  const subject = deriveSubject(text || parsed.data.bodyMd || "");

  const db = await getDb();
  const thread = await db.managerThread.create({
    data: {
      projectId: JANICKA_PROJECT_ID,
      subject: subject || null,
      status: "pending",
      messages: {
        create: {
          role: "user",
          contentJson: JSON.stringify(blocks),
          imageKeys: JSON.stringify(parsed.data.imageKeys ?? []),
        },
      },
    },
    include: { messages: true },
  });

  return NextResponse.json(
    {
      thread: {
        id: thread.id,
        subject: thread.subject,
        status: thread.status,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
        messages: thread.messages.map((m) => ({
          id: m.id,
          role: m.role,
          blocks: parseBlocks(m.contentJson),
          createdAt: m.createdAt.toISOString(),
        })),
      },
    },
    { status: 201 },
  );
}
