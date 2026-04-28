"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const PIE_COLORS = [
  "#ec4899",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

type Block =
  | { id: string; type: "text"; bodyMd: string }
  | {
      id: string;
      type: "chart";
      chartType: "bar" | "line" | "pie";
      title?: string;
      data: Array<{ label: string; value: number }>;
    }
  | { id: string; type: "image"; url: string; caption?: string }
  | {
      id: string;
      type: "actions";
      buttons: Array<{
        id: string;
        label: string;
        action: string;
        payload?: unknown;
      }>;
    }
  | {
      id: string;
      type: "poll";
      question: string;
      options: Array<{ id: string; label: string }>;
    }
  | { id: string; type: "table"; headers: string[]; rows: string[][] }
  | { id: string; type: "code"; language: string; source: string };

export function ThreadMessageBlocks({ blocks }: { blocks: Block[] }) {
  if (!blocks || blocks.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">(prázdná zpráva)</p>
    );
  }
  return (
    <div className="space-y-3">
      {blocks.map((b) => (
        <BlockRender key={b.id} block={b} />
      ))}
    </div>
  );
}

function BlockRender({ block }: { block: Block }) {
  if (block.type === "text") {
    return (
      <div className="prose prose-sm max-w-none prose-headings:font-heading prose-p:my-1 prose-ul:my-1 prose-ol:my-1 dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.bodyMd}</ReactMarkdown>
      </div>
    );
  }
  if (block.type === "chart") {
    return <ChartBlock block={block} />;
  }
  if (block.type === "image") {
    return (
      <figure className="space-y-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={block.url}
          alt={block.caption ?? "Obrázek od manažerky"}
          className="rounded-lg border max-h-72 object-contain"
        />
        {block.caption && (
          <figcaption className="text-xs text-muted-foreground">
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  if (block.type === "actions") {
    return (
      <div className="flex flex-wrap gap-2">
        {block.buttons.map((b) => (
          <button
            key={b.id}
            type="button"
            disabled
            title="Akce — zatím jen zobrazení (J28)"
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary disabled:cursor-not-allowed disabled:opacity-70"
          >
            {b.label}
          </button>
        ))}
      </div>
    );
  }
  if (block.type === "poll") {
    return (
      <div className="space-y-1.5 rounded-lg border border-foreground/10 bg-background/50 p-3">
        <p className="text-sm font-medium">{block.question}</p>
        <div className="flex flex-wrap gap-2">
          {block.options.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled
              className="rounded-md border px-2.5 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-70"
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (block.type === "table") {
    return (
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-xs">
          <thead className="bg-foreground/[0.04]">
            <tr>
              {block.headers.map((h, i) => (
                <th key={i} className="px-2 py-1.5 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i} className="border-t">
                {r.map((c, j) => (
                  <td key={j} className="px-2 py-1.5">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === "code") {
    return (
      <pre className="overflow-x-auto rounded-md bg-foreground/[0.06] p-2 text-xs">
        <code>{block.source}</code>
      </pre>
    );
  }
  return (
    <pre className="overflow-x-auto rounded-md bg-foreground/[0.04] p-2 text-[10px] text-muted-foreground">
      {JSON.stringify(block, null, 2)}
    </pre>
  );
}

function ChartBlock({
  block,
}: {
  block: Extract<Block, { type: "chart" }>;
}) {
  if (!block.data || block.data.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">
        Graf — žádná data.
      </p>
    );
  }
  return (
    <div className="rounded-lg border border-foreground/10 bg-background/50 p-2">
      {block.title && (
        <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">
          {block.title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={180}>
        {block.chartType === "bar" ? (
          <BarChart data={block.data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" fontSize={10} />
            <YAxis fontSize={10} />
            <Tooltip />
            <Bar dataKey="value" fill="#ec4899" />
          </BarChart>
        ) : block.chartType === "pie" ? (
          <PieChart>
            <Pie
              data={block.data}
              dataKey="value"
              nameKey="label"
              outerRadius={70}
              label
            >
              {block.data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : (
          <LineChart data={block.data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" fontSize={10} />
            <YAxis fontSize={10} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#ec4899"
              strokeWidth={2}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
