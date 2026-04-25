"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  FileText,
  StickyNote,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ManagerArtifact } from "@/lib/jarvis-db";

import { formatCzDate, previewText } from "./task-meta";

const KIND_LABELS: Record<string, string> = {
  note: "Poznámka",
  report: "Reportík",
  chart: "Graf",
};

const KIND_ICONS: Record<string, React.ElementType> = {
  note: StickyNote,
  report: FileText,
  chart: BarChart3,
};

const CHART_COLORS = [
  "#7c3aed",
  "#10b981",
  "#0ea5e9",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
  "#84cc16",
];

type ChartShape = {
  type?: "line" | "bar" | "area" | "pie";
  data?: Array<Record<string, unknown>>;
  xKey?: string;
  yKeys?: string[];
  // For pie:
  nameKey?: string;
  valueKey?: string;
};

function parseChartJson(body_json: string | null): ChartShape | null {
  if (!body_json) return null;
  try {
    const parsed = JSON.parse(body_json) as ChartShape;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function inferKeys(data: Array<Record<string, unknown>>): {
  xKey: string;
  yKeys: string[];
} {
  if (data.length === 0) return { xKey: "x", yKeys: ["y"] };
  const sample = data[0];
  const keys = Object.keys(sample);
  if (keys.length === 0) return { xKey: "x", yKeys: ["y"] };
  const xCandidates = ["date", "label", "name", "x", "category"];
  const xKey =
    keys.find((k) => xCandidates.includes(k.toLowerCase())) ?? keys[0];
  const yKeys = keys.filter(
    (k) => k !== xKey && typeof sample[k] === "number",
  );
  return { xKey, yKeys: yKeys.length > 0 ? yKeys : keys.slice(1) };
}

function ArtifactChart({ json }: { json: string | null }) {
  const shape = useMemo(() => parseChartJson(json), [json]);
  if (!shape || !shape.data || shape.data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Graf nelze vykreslit (chybí data).
      </p>
    );
  }

  const inferred = inferKeys(shape.data);
  const xKey = shape.xKey ?? inferred.xKey;
  const yKeys = shape.yKeys && shape.yKeys.length > 0 ? shape.yKeys : inferred.yKeys;
  const type = shape.type ?? "line";

  if (type === "pie") {
    const nameKey = shape.nameKey ?? xKey;
    const valueKey = shape.valueKey ?? yKeys[0];
    return (
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={shape.data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius={80}
            label
          >
            {shape.data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const ChartCmp = type === "bar" ? BarChart : type === "area" ? AreaChart : LineChart;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ChartCmp data={shape.data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey={xKey} className="text-xs" />
        <YAxis className="text-xs" />
        <Tooltip />
        <Legend />
        {yKeys.map((k, i) => {
          const color = CHART_COLORS[i % CHART_COLORS.length];
          if (type === "bar")
            return <Bar key={k} dataKey={k} fill={color} radius={[4, 4, 0, 0]} />;
          if (type === "area")
            return (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                stroke={color}
                fill={color}
                fillOpacity={0.25}
              />
            );
          return (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
          );
        })}
      </ChartCmp>
    </ResponsiveContainer>
  );
}

export function ArtifactCard({ artifact }: { artifact: ManagerArtifact }) {
  const [open, setOpen] = useState(false);
  const Icon = KIND_ICONS[artifact.kind] ?? StickyNote;
  const kindLabel = KIND_LABELS[artifact.kind] ?? artifact.kind;
  const title = artifact.title ?? "(bez názvu)";
  const body = artifact.body_md ?? "";

  return (
    <article className="rounded-lg border bg-card p-3 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {kindLabel}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {formatCzDate(artifact.created_at)}
            </span>
          </div>
          {!open && body ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {previewText(body, 220)}
            </p>
          ) : null}
        </div>
        <span className="ml-auto text-muted-foreground">
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 border-t pt-3">
          {artifact.kind === "chart" ? (
            <ArtifactChart json={artifact.body_json} />
          ) : null}
          {body ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
            </div>
          ) : artifact.kind !== "chart" ? (
            <p className="text-xs text-muted-foreground">(bez obsahu)</p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
