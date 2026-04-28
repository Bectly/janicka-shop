import { NextResponse, connection } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  JANICKA_PROJECT_ID,
  ThreadBlocksSchema,
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

const ReplySchema = z.object({
  bodyMd: z.string().min(1).max(4000).optional(),
  blocks: ThreadBlocksSchema.optional(),
  imageKeys: z.array(z.string().min(1).max(300)).max(8).optional(),
});

/**
 * POST /api/admin/manager/threads/[id]/reply — user posts a reply to a thread.
 * Allowed when status is `awaiting_user` or `answered` (Janička follows up).
 * Resets status to `pending` so the watcher re-processes for a manager reply.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await connection();
  const guard = await requireAdmin();
  if (guard) return guard;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ReplySchema.safeParse(body);
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
      { error: "Odpověď musí obsahovat text nebo bloky" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const thread = await db.managerThread.findUnique({
    where: { id },
    select: { id: true, projectId: true, status: true },
  });
  if (!thread || thread.projectId !== JANICKA_PROJECT_ID) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }
  // Don't accept replies into a thread the watcher is mid-processing — the
  // user message would race with the manager write and confuse the prompt.
  if (thread.status === "processing") {
    return NextResponse.json(
      { error: "Manažerka teď odpovídá, počkej chvilku." },
      { status: 409 },
    );
  }

  const message = await db.managerThreadMessage.create({
    data: {
      threadId: id,
      role: "user",
      contentJson: JSON.stringify(blocks),
      imageKeys: JSON.stringify(parsed.data.imageKeys ?? []),
    },
  });
  await db.managerThread.update({
    where: { id },
    data: { status: "pending" },
  });

  return NextResponse.json(
    {
      ok: true,
      message: {
        id: message.id,
        role: message.role,
        blocks: parseBlocks(message.contentJson),
        createdAt: message.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
