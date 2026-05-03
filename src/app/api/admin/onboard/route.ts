import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getDb } from "@/lib/db";

export async function PATCH() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  await db.admin.update({
    where: { email: session.user.email },
    data: { onboardedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
