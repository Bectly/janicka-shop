import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { composeAndSendEmail, type SendCategory } from "@/lib/mailbox/send";

type Body = {
  to?: string | string[];
  subject?: string;
  body?: string;
  category?: string;
};

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: Body;
  try {
    payload = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const category: SendCategory =
    payload.category === "orders" || payload.category === "info" ? payload.category : "support";

  const result = await composeAndSendEmail({
    to: payload.to ?? "",
    subject: payload.subject ?? "",
    body: payload.body ?? "",
    category,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
