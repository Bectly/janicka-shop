import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PATCH() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  await db.admin.update({
    where: { id: session.user.id },
    data: { onboardedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
