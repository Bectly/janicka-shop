import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { replyOnThread } from "@/lib/mailbox/send";

type Body = { body?: string };

export async function POST(
  req: Request,
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

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const result = await replyOnThread({ threadId, body: payload.body ?? "" });
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
