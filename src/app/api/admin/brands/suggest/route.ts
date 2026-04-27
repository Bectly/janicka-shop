import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import { readDraftSession } from "@/lib/draft-session"

export async function GET(req: NextRequest) {
  const session = await auth()
  const isAdmin = session?.user?.id && session.user.role === "admin"
  if (!isAdmin) {
    // Allow mobile draft-session (QR-paired) clients — same admin scope, just different cookie.
    const draftSession = await readDraftSession()
    if (!draftSession) {
      return NextResponse.json({ brands: [] }, { status: 401 })
    }
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? ""
  if (q.length < 1) return NextResponse.json({ brands: [] })

  const db = await getDb()

  const [products, drafts] = await Promise.all([
    db.product.findMany({
      where: { brand: { contains: q, not: null } },
      select: { brand: true },
      take: 200,
    }),
    db.productDraft.findMany({
      where: { brand: { contains: q, not: null } },
      select: { brand: true },
      take: 100,
    }),
  ])

  // Count frequency across both sources
  const counts = new Map<string, number>()

  for (const p of products) {
    if (!p.brand) continue
    counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1)
  }

  for (const d of drafts) {
    if (!d.brand) continue
    counts.set(d.brand, (counts.get(d.brand) ?? 0) + 1)
  }

  const brands = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([brand]) => brand)

  return NextResponse.json({ brands })
}
