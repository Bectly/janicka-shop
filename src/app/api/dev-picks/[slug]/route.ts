import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { z } from "zod";

const answerPickSchema = z.object({
  selectedOption: z.string().max(500).optional(),
  customText: z.string().max(5000).optional(),
});

/**
 * GET /api/dev-picks/[slug] — Public. Fetch a pick by slug.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const db = await getDb();
  const pick = await db.devPick.findUnique({ where: { slug } });

  if (!pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  // Check expiry
  if (
    pick.status === "pending" &&
    pick.expiresAt &&
    new Date() > pick.expiresAt
  ) {
    await db.devPick.update({
      where: { slug },
      data: { status: "expired" },
    });
    pick.status = "expired";
  }

  return NextResponse.json({
    ...pick,
    options: JSON.parse(pick.options),
  });
}

/**
 * PATCH /api/dev-picks/[slug] — Public. Janička answers a pick.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = answerPickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { selectedOption, customText } = parsed.data;

  if (!selectedOption && !customText) {
    return NextResponse.json(
      { error: "Must provide selectedOption or customText" },
      { status: 400 },
    );
  }

  const db = await getDb();
  const pick = await db.devPick.findUnique({ where: { slug } });

  if (!pick) {
    return NextResponse.json({ error: "Pick not found" }, { status: 404 });
  }

  if (pick.status === "answered") {
    return NextResponse.json(
      { error: "Already answered", answeredAt: pick.answeredAt },
      { status: 409 },
    );
  }

  if (pick.status === "expired") {
    return NextResponse.json({ error: "Pick has expired" }, { status: 410 });
  }

  if (pick.status === "superseded") {
    return NextResponse.json(
      { error: "Pick has been superseded" },
      { status: 410 },
    );
  }

  const updated = await db.devPick.update({
    where: { slug },
    data: {
      selectedOption: selectedOption ?? null,
      customText: customText ?? null,
      status: "answered",
      answeredAt: new Date(),
    },
  });

  return NextResponse.json({
    ...updated,
    options: JSON.parse(updated.options),
  });
}
