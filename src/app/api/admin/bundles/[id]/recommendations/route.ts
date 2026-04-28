import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCachedRecommendation } from "@/lib/bundles/recommendations";

async function handle(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const reco = await getCachedRecommendation(id, { force });
  if (!reco) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(reco);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(req, ctx);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return handle(req, ctx);
}
