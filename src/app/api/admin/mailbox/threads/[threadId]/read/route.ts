import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { markThreadRead } from "@/lib/mailbox/send";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  if (typeof threadId !== "string" || !threadId) {
    return NextResponse.json(
      { ok: false, error: "Missing threadId" },
      { status: 400 },
    );
  }

  const result = await markThreadRead(threadId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
