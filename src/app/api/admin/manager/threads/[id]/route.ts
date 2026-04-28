import { NextResponse, connection } from "next/server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  JANICKA_PROJECT_ID,
  parseBlocks,
  parseImageKeys,
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
 * GET /api/admin/manager/threads/[id] — single thread + all messages ordered
 * by createdAt ASC.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await connection();
  const guard = await requireAdmin();
  if (guard) return guard;

  const { id } = await ctx.params;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const db = await getDb();
  const thread = await db.managerThread.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { actions: true },
      },
    },
  });

  if (!thread || thread.projectId !== JANICKA_PROJECT_ID) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  return NextResponse.json({
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
        imageKeys: parseImageKeys(m.imageKeys),
        readAt: m.readAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
        actions: m.actions.map((a) => ({
          id: a.id,
          blockId: a.blockId,
          buttonId: a.buttonId,
          actionType: a.actionType,
          status: a.status,
          executedAt: a.executedAt?.toISOString() ?? null,
        })),
      })),
    },
  });
}
