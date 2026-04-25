"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { FileText, BarChart3, StickyNote, ChevronDown, ChevronUp } from "lucide-react";
import { CommentThread } from "@/components/admin/manager/comment-thread";

type Comment = {
  id: string;
  authorRole: string;
  authorName: string | null;
  bodyMd: string;
  createdAt: Date | string;
};

type Artifact = {
  id: string;
  kind: string;
  title: string | null;
  bodyMd: string | null;
  bodyJson: string | null;
  status: string;
  mood: string | null;
  createdAt: Date | string;
  comments?: Comment[];
};

const MOOD_TINT: Record<string, string> = {
  positive: "border-emerald-500/30 bg-emerald-500/5",
  concern: "border-amber-500/30 bg-amber-500/5",
  urgent: "border-red-500/30 bg-red-500/5",
};

const KIND_ICON: Record<string, typeof FileText> = {
  note: StickyNote,
  chart: BarChart3,
  report: FileText,
};

const PIE_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function formatCestDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(date);
}

function ChartRender({ json }: { json: unknown }) {
  if (!json || typeof json !== "object") return null;
  const j = json as { type?: string; data?: Array<Record<string, unknown>>; x_label?: string; y_label?: string };
  const data = Array.isArray(j.data) ? j.data : [];
  if (data.length === 0) {
    return <div className="text-xs text-muted-foreground italic">Žádná data v grafu.</div>;
  }
  const type = j.type ?? "line";
  const xKey = "x" in data[0] ? "x" : Object.keys(data[0])[0];
  const yKey = "y" in data[0] ? "y" : Object.keys(data[0])[1] ?? Object.keys(data[0])[0];

  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
      <XAxis dataKey={xKey} fontSize={10} />
      <YAxis fontSize={10} />
      <Tooltip />
    </>
  );

  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          {common}
          <Bar dataKey={yKey} fill="#0ea5e9" />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey={yKey} nameKey={xKey} outerRadius={70} label>
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          {common}
          <Area type="monotone" dataKey={yKey} stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.3} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  // default: line
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        {common}
        <Line type="monotone" dataKey={yKey} stroke="#0ea5e9" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = KIND_ICON[artifact.kind] ?? FileText;

  const tint = artifact.mood ? MOOD_TINT[artifact.mood] : "border-foreground/15 bg-card";

  let payload: Record<string, unknown> | null = null;
  if (artifact.bodyJson) {
    try {
      payload = JSON.parse(artifact.bodyJson) as Record<string, unknown>;
    } catch {
      payload = null;
    }
  }

  const titleText = artifact.title || (payload?.title as string) || `(${artifact.kind})`;
  const bodyMd = artifact.bodyMd || (payload?.body_md as string) || "";

  return (
    <article className={`rounded-lg border ${tint} p-4 shadow-sm`}>
      <header className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 shrink-0 text-primary" />
          <h3 className="font-medium text-sm truncate">{titleText}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
          <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] uppercase">
            {artifact.kind}
          </span>
          <span>{formatCestDate(artifact.createdAt)}</span>
        </div>
      </header>

      {artifact.kind === "chart" && payload && (
        <div className="mt-2">
          <ChartRender json={payload} />
        </div>
      )}

      {artifact.kind !== "chart" && bodyMd && (
        <div className="mt-2">
          <div
            className={`prose prose-sm max-w-none text-foreground/90 ${
              expanded || bodyMd.length < 300 ? "" : "line-clamp-4"
            }`}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{bodyMd}</ReactMarkdown>
          </div>
          {bodyMd.length >= 300 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3" /> Skrýt
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" /> Více
                </>
              )}
            </button>
          )}
        </div>
      )}

      <CommentThread
        parentType="artifact"
        parentId={artifact.id}
        comments={artifact.comments ?? []}
      />
    </article>
  );
}
