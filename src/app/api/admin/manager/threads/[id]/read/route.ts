import { NextResponse, connection } from "next/server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { JANICKA_PROJECT_ID } from "@/lib/manager-thread";

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
 * POST /api/admin/manager/threads/[id]/read — mark all unread manager messages
 * in the thread as read by the user (sets readAt=now()).
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await connection();
  const guard = await requireAdmin();
  if (guard) return guard;

  const { id } = await ctx.params;
  const db = await getDb();
  const thread = await db.managerThread.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!thread || thread.projectId !== JANICKA_PROJECT_ID) {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const result = await db.managerThreadMessage.updateMany({
    where: { threadId: id, role: "manager", readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true, marked: result.count });
}
