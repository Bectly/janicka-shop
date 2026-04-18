"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { parseDescription } from "@/lib/description-parser";

const COLLAPSE_THRESHOLD = 500;

export function ProductDescription({ text }: { text: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const blocks = parseDescription(text);
  if (blocks.length === 0) return null;

  const raw = text ?? "";
  const isLong = raw.length > COLLAPSE_THRESHOLD;
  const visibleBlocks = !isLong || expanded ? blocks : truncateBlocks(blocks, COLLAPSE_THRESHOLD);

  return (
    <div className="mt-5 space-y-3 text-sm leading-relaxed text-foreground/80 sm:text-base">
      {visibleBlocks.map((block, i) =>
        block.type === "list" ? (
          <ul
            key={i}
            className="list-disc space-y-1 pl-5 marker:text-muted-foreground"
          >
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{block.text}</p>
        ),
      )}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center gap-1 rounded text-sm font-medium text-primary underline-offset-4 transition-all duration-150 hover:text-primary/80 hover:underline active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {expanded ? "Zobrazit méně" : "Zobrazit více"}
          <ChevronDown className={`size-3.5 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

function truncateBlocks(
  blocks: ReturnType<typeof parseDescription>,
  limit: number,
): ReturnType<typeof parseDescription> {
  const out: ReturnType<typeof parseDescription> = [];
  let used = 0;
  for (const b of blocks) {
    const len = b.type === "paragraph" ? b.text.length : b.items.join(" ").length;
    if (used + len <= limit) {
      out.push(b);
      used += len;
    } else {
      const remain = Math.max(80, limit - used);
      if (b.type === "paragraph") {
        out.push({ type: "paragraph", text: b.text.slice(0, remain).trimEnd() + "…" });
      } else {
        out.push(b);
      }
      break;
    }
  }
  return out.length > 0 ? out : blocks.slice(0, 1);
}
