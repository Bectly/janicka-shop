export type DescriptionBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const BULLET_RE = /^\s*(?:[-•*]|\u2022)\s+(.*\S)\s*$/;

export function parseDescription(raw: string | null | undefined): DescriptionBlock[] {
  if (!raw) return [];
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const blocks: DescriptionBlock[] = [];
  const paragraphs = text.split(/\n{2,}/);

  for (const para of paragraphs) {
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const bulletMatches = lines.map((l) => l.match(BULLET_RE));
    const bulletCount = bulletMatches.filter(Boolean).length;

    if (bulletCount >= 2 && bulletCount === lines.length) {
      blocks.push({
        type: "list",
        items: bulletMatches.map((m) => m![1]),
      });
    } else {
      blocks.push({ type: "paragraph", text: lines.join(" ") });
    }
  }

  return blocks;
}
