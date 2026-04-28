import { NextResponse } from "next/server";
import { cacheLife, cacheTag } from "next/cache";
import { auth } from "@/lib/auth";
import { calcBundleROI, type BundleROI } from "@/lib/bundles/roi";
import { checkBundleBreakEven } from "@/lib/bundles/break-even-alert";

async function loadBundleROI(id: string): Promise<BundleROI | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`admin-bundle-roi:${id}`);
  return calcBundleROI(id);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const roi = await loadBundleROI(id);
  if (!roi) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fire-and-forget break-even check — also covered by order-paid hook,
  // this is a defensive secondary trigger for cases where the hook missed.
  if (roi.investment > 0 && roi.revenue >= roi.investment) {
    void checkBundleBreakEven(id).catch(() => {});
  }

  return NextResponse.json(roi);
}
