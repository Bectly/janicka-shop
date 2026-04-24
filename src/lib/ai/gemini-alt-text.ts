/**
 * Gemini Flash wrapper for Czech product image alt-text + caption generation.
 *
 * Covers WCAG 1.1.1 (non-text content) for screen readers and boosts LLM/image-search
 * citation per Scout Update #3 (73% higher AI citation with descriptive image text).
 *
 * Flash 2.0 is the cheapest vision-capable model (~$0.0001/image at current rates).
 *
 * API: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
 * Auth: x-goog-api-key header (GEMINI_API_KEY)
 */

import { logger } from "@/lib/logger";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const ALT_MAX = 125; // WCAG/SEO sweet spot
const CAPTION_MAX = 200;

const CONDITION_LABEL: Record<string, string> = {
  new_with_tags: "nové s visačkou",
  new_without_tags: "nové bez visačky",
  excellent: "výborný stav",
  good: "dobrý stav",
  visible_wear: "viditelné opotřebení",
};

export interface GenerateAltTextInput {
  imageUrl: string;
  productName: string;
  brand?: string | null;
  condition?: string | null;
  sizes?: string[];
  categoryName?: string | null;
}

export interface GeneratedAltText {
  altText: string;
  caption: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
}

/**
 * Fetch image bytes and base64-encode for inline_data payload.
 * Gemini accepts image_url-style URIs only via the Files API; inline base64 is
 * simpler for one-shot calls (4 MB image budget is well under Flash's 20 MB cap).
 */
async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    return { data: buf.toString("base64"), mimeType };
  } catch {
    return null;
  }
}

function buildPrompt(input: GenerateAltTextInput): string {
  const meta: string[] = [`Produkt: ${input.productName}`];
  if (input.brand) meta.push(`Značka: ${input.brand}`);
  if (input.categoryName) meta.push(`Kategorie: ${input.categoryName}`);
  if (input.condition && CONDITION_LABEL[input.condition]) {
    meta.push(`Stav: ${CONDITION_LABEL[input.condition]}`);
  }
  if (input.sizes && input.sizes.length > 0) meta.push(`Velikost: ${input.sizes.join(", ")}`);

  return `Jsi český copywriter pro second hand eshop. Napiš pro tuto fotku produktu:
1) ALT TEXT (max ${ALT_MAX} znaků) — stručný popis pro screen readery a Google obrázky. Česky, bez emoji, bez tečky na konci. Popiš co vidíš (typ oblečení, barva, vzor, materiál pokud zřejmý).
2) CAPTION (max ${CAPTION_MAX} znaků) — delší marketingový popis pro AI vyhledávače. Česky, přirozený jazyk, zmiň styl a kdy se hodí nosit.

Kontext produktu:
${meta.join("\n")}

Odpověz POUZE ve formátu (žádný úvod, žádné značky):
ALT: <alt text>
CAPTION: <caption>`;
}

function parseModelOutput(text: string): GeneratedAltText | null {
  const altMatch = /^ALT:\s*(.+)$/im.exec(text);
  const capMatch = /^CAPTION:\s*([\s\S]+)$/im.exec(text);
  if (!altMatch) return null;
  const altText = altMatch[1].trim().replace(/[.\s]+$/, "").slice(0, ALT_MAX);
  const caption = (capMatch?.[1] || "").trim().slice(0, CAPTION_MAX);
  if (!altText) return null;
  return { altText, caption };
}

/**
 * Generate Czech alt-text + caption for a product image.
 * Returns null on API failure or missing GEMINI_API_KEY (graceful degradation).
 */
export async function generateAltText(
  input: GenerateAltTextInput,
): Promise<GeneratedAltText | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const image = await fetchImageAsBase64(input.imageUrl);
  if (!image) {
    logger.error(`[Gemini alt-text] Could not fetch image: ${input.imageUrl}`);
    return null;
  }

  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: image.mimeType, data: image.data } },
          { text: buildPrompt(input) },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 256,
    },
  };

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    const json = (await res.json()) as GeminiResponse;
    if (!res.ok) {
      logger.error(`[Gemini alt-text] ${res.status}: ${json.error?.message || res.statusText}`);
      return null;
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = parseModelOutput(text);
    if (!parsed) {
      logger.error(`[Gemini alt-text] Unparseable output: ${text.slice(0, 200)}`);
      return null;
    }
    return parsed;
  } catch (err) {
    logger.error("[Gemini alt-text] Request failed:", err);
    return null;
  }
}
