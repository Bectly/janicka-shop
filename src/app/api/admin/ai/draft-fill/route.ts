import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface DraftFillRequest {
  draftIds: string[];
  batchId: string;
}

interface DraftFillResult {
  draftId: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
}

interface DraftRow {
  id: string;
  name: string | null;
  brand: string | null;
  condition: string | null;
  sizes: string;
}

function generateDraftContent(draft: DraftRow): {
  description: string;
  metaTitle: string;
  metaDescription: string;
} {
  const name = draft.name ?? "Kousek";
  const brand = draft.brand ? ` ${draft.brand}` : "";
  const condition =
    draft.condition === "new_with_tags"
      ? "Nové se štítkem"
      : draft.condition === "excellent"
        ? "Výborný stav"
        : draft.condition === "good"
          ? "Dobrý stav"
          : "Viditelné opotřebení";
  return {
    description: `${name}${brand} — ${condition.toLowerCase()}. Unikátní kousek z druhé ruky.`,
    metaTitle: `${name}${brand} | Janička Shop`,
    metaDescription: `Kupte ${name}${brand} ve stavu: ${condition.toLowerCase()}. Originální second hand na Janička Shop.`.slice(
      0,
      160,
    ),
  };
}

async function generateWithClaude(draft: DraftRow): Promise<{
  description: string;
  metaTitle: string;
  metaDescription: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return generateDraftContent(draft);
  }

  const prompt = `Vygeneruj krátký popis, meta název a meta popis pro second-hand produkt: název=${draft.name ?? "Kousek"}, značka=${draft.brand ?? "neznámá"}, stav=${draft.condition ?? "good"}. Odpověz JSON: {description, metaTitle, metaDescription}.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      return generateDraftContent(draft);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const text = data.content.find((c) => c.type === "text")?.text ?? "";

    // Extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return generateDraftContent(draft);
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      description?: string;
      metaTitle?: string;
      metaDescription?: string;
    };

    if (!parsed.description || !parsed.metaTitle || !parsed.metaDescription) {
      return generateDraftContent(draft);
    }

    return {
      description: String(parsed.description),
      metaTitle: String(parsed.metaTitle),
      metaDescription: String(parsed.metaDescription).slice(0, 160),
    };
  } catch {
    return generateDraftContent(draft);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { draftIds, batchId } = body as DraftFillRequest;

  if (
    !batchId ||
    typeof batchId !== "string" ||
    !Array.isArray(draftIds) ||
    draftIds.length === 0 ||
    draftIds.length > 100
  ) {
    return NextResponse.json({ error: "Neplatné parametry" }, { status: 400 });
  }

  const db = await getDb();

  const drafts = await db.productDraft.findMany({
    where: { id: { in: draftIds }, batchId },
    select: { id: true, name: true, brand: true, condition: true, sizes: true },
  });

  const results: DraftFillResult[] = await Promise.all(
    drafts.map(async (draft) => {
      const content = await generateWithClaude(draft);
      return { draftId: draft.id, ...content };
    }),
  );

  return NextResponse.json({ results });
}
