import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimitAdmin } from "@/lib/rate-limit";
import { getDb } from "@/lib/db";
import { sendVintedCampaignEmail } from "@/lib/email";
import type { VintedCampaignSegment } from "@/lib/email";

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1100;

/**
 * POST /api/admin/campaign/vinted-tc
 * Send the pre-built Vinted T&C privacy campaign to newsletter subscribers.
 *
 * Body: { segment: "warm" | "cold" | "all" }
 * - warm: Subject A to all subscribers
 * - cold: Subject B to all subscribers
 * - all: auto-segment by subscriber recency (90 days)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimitAdmin();
  if (!rl.success) {
    return NextResponse.json(
      { error: "Příliš mnoho požadavků. Zkuste to za chvíli." },
      { status: 429 },
    );
  }

  let body: { segment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Neplatný JSON." },
      { status: 400 },
    );
  }

  const segment = body.segment ?? "all";
  if (segment !== "warm" && segment !== "cold" && segment !== "all") {
    return NextResponse.json(
      { error: "Segment musí být 'warm', 'cold', nebo 'all'." },
      { status: 400 },
    );
  }

  const db = await getDb();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const subscribers = await db.newsletterSubscriber.findMany({
    where: {
      active: true,
      OR: [
        { pausedUntil: null },
        { pausedUntil: { lt: now } },
      ],
    },
    select: { email: true, createdAt: true },
  });

  if (subscribers.length === 0) {
    return NextResponse.json({ ok: true, sentCount: 0, failedCount: 0 });
  }

  const tagged: { email: string; segment: VintedCampaignSegment }[] =
    subscribers.map((s) => {
      if (segment === "all") {
        return {
          email: s.email,
          segment: (s.createdAt >= ninetyDaysAgo ? "warm" : "cold") as VintedCampaignSegment,
        };
      }
      return { email: s.email, segment: segment as VintedCampaignSegment };
    });

  const subjectDesc =
    segment === "all"
      ? "Vinted T&C kampaň (auto-segment)"
      : segment === "warm"
        ? "Vinted T&C kampaň — Tvoje fotky patří tobě. Vždy."
        : "Vinted T&C kampaň — Zatímco Vinted školí AI...";

  const campaign = await db.campaignLog.create({
    data: {
      subject: subjectDesc,
      previewText: "U nás je to jinak. A vždy bylo.",
      status: "sending",
    },
  });

  let sentCount = 0;
  let failedCount = 0;

  for (let i = 0; i < tagged.length; i += BATCH_SIZE) {
    const batch = tagged.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((sub) => sendVintedCampaignEmail(sub.segment, sub.email)),
    );
    for (const ok of results) {
      if (ok) sentCount++;
      else failedCount++;
    }

    if (i + BATCH_SIZE < tagged.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  await db.campaignLog.update({
    where: { id: campaign.id },
    data: { status: "completed", sentCount, failedCount },
  });

  return NextResponse.json({ ok: true, sentCount, failedCount });
}
