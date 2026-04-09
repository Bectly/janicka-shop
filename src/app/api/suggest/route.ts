import { NextRequest, NextResponse } from "next/server";

const MAPY_API_URL = "https://api.mapy.com/v1/suggest";
const MAPY_TIMEOUT_MS = 5_000;

/**
 * Server-side proxy for Mapy.com Suggest API.
 * Protects MAPY_API_KEY from client exposure — no NEXT_PUBLIC_ prefix needed.
 * Uses RUIAN (official CZ address registry) for best Czech address coverage.
 */
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2 || query.length > 200) {
    return NextResponse.json({ items: [] });
  }

  const apiKey = process.env.MAPY_API_KEY;
  if (!apiKey) {
    console.error("[Suggest] Missing MAPY_API_KEY environment variable");
    return NextResponse.json({ items: [] }, { status: 500 });
  }

  const url = new URL(MAPY_API_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("lang", "cs");
  url.searchParams.set("limit", "6");
  url.searchParams.set("type", "regional.address");
  url.searchParams.set("locality", "cz");
  url.searchParams.set("apikey", apiKey);

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(MAPY_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error(`[Suggest] Mapy.com API error: ${res.status}`);
      return NextResponse.json({ items: [] }, { status: 502 });
    }

    const data = await res.json();

    // Transform to only the fields the client needs
    const items = (data.items ?? []).map(
      (item: {
        name: string;
        label: string;
        zip?: string;
        regionalStructure?: { type: string; name: string }[];
      }) => {
        const city =
          item.regionalStructure?.find(
            (r: { type: string }) => r.type === "regional.municipality",
          )?.name ?? "";
        return {
          street: item.name,
          label: item.label,
          city,
          zip: item.zip ?? "",
        };
      },
    );

    return NextResponse.json({ items });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      console.error("[Suggest] Mapy.com API timeout");
      return NextResponse.json({ items: [] }, { status: 504 });
    }
    console.error("[Suggest] Mapy.com API error:", e);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}
