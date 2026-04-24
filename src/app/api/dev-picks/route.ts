import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { z } from "zod";

function isLeadAuthorized(request: Request): boolean {
  const apiKey = process.env.LEAD_API_KEY;
  if (!apiKey) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${apiKey}`;
}

const createPickSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with dashes"),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  pickType: z.enum(["choice", "text", "rating", "image_choice"]),
  options: z.array(z.record(z.string(), z.unknown())).default([]),
  expiresAt: z.string().datetime().optional(),
});

/**
 * POST /api/dev-picks — Lead creates a new pick for Janička.
 * Auth: LEAD_API_KEY Bearer token.
 */
export async function POST(request: Request) {
  if (!isLeadAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { slug, title, description, pickType, options, expiresAt } =
    parsed.data;

  const db = await getDb();

  // Check slug uniqueness
  const existing = await db.devPick.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: "Slug already exists", slug },
      { status: 409 },
    );
  }

  const pick = await db.devPick.create({
    data: {
      slug,
      title,
      description,
      pickType,
      options: JSON.stringify(options),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json(
    { id: pick.id, slug: pick.slug, url: `/pick/${pick.slug}` },
    { status: 201 },
  );
}

/**
 * GET /api/dev-picks — Lead reads picks (with optional status filter).
 * Auth: LEAD_API_KEY Bearer token.
 */
export async function GET(request: Request) {
  if (!isLeadAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limitParam = parseInt(url.searchParams.get("limit") ?? "50");
  const limit = Math.min(Math.max(1, limitParam), 100);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const db = await getDb();
  const picks = await db.devPick.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const parsed_picks = picks.map((p) => ({
    ...p,
    options: JSON.parse(p.options),
  }));

  return NextResponse.json({ picks: parsed_picks, count: picks.length });
}
