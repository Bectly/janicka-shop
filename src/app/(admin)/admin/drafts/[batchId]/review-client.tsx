"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MessageCircle,
  Sparkles,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckSquare,
  Square,
  Star,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CONDITION_LABELS } from "@/lib/constants";

import {
  bulkUpdateDraftsAction,
  deleteBatchAction,
  discardDraftAction,
  publishDraftsAction,
  reopenBatchAction,
  updateDraftAction,
} from "./actions";

interface DraftRow {
  id: string;
  name: string | null;
  price: number | null;
  compareAt: number | null;
  featured: boolean;
  categoryId: string | null;
  brand: string | null;
  condition: string | null;
  sizes: string[];
  images: string[];
  description: string | null;
  measurements: string;
  fitNote: string | null;
  defectsNote: string | null;
  internalNote: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  videoUrl: string | null;
  status: string;
  publishedProductId: string | null;
  createdAt: string;
  weightG: number | null;
}

interface Category {
  id: string;
  name: string;
}

interface BundleInfo {
  id: string;
  name: string;
}

interface BundleLineInfo {
  name: string;
  kg: number;
  pricePerKg: number;
  totalPrice: number;
}

interface BatchReviewClientProps {
  batchId: string;
  status: string;
  sealedAt: string | null;
  createdAt: string;
  defaultWeightG: number | null | undefined;
  timingsJson: string;
  drafts: DraftRow[];
  categories: Category[];
  bundle: BundleInfo | null;
  bundleLine: BundleLineInfo | null;
}

const QUICK_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "34", "36", "38", "40", "42"] as const;

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  open: { label: "Otevřený", className: "bg-blue-100 text-blue-900" },
  sealed: { label: "Uzavřený", className: "bg-amber-100 text-amber-900" },
  published: { label: "Publikovaný", className: "bg-emerald-100 text-emerald-900" },
  expired: { label: "Vypršený", className: "bg-muted text-muted-foreground" },
};

// --- Completeness scoring ---

function scoreDraft(d: DraftRow): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!d.name) missing.push("název");
  if (!d.price) missing.push("cena");
  if (!d.categoryId) missing.push("kategorie");
  if (!d.brand) missing.push("značka");
  if (!d.condition) missing.push("stav");
  if (!d.sizes.length) missing.push("velikost");
  return { complete: missing.length === 0, missing };
}

function CompleteBadge({ draft }: { draft: DraftRow }) {
  const { complete, missing } = scoreDraft(draft);
  if (complete) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        <Check className="size-3" aria-hidden />
        kompletní
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      <AlertCircle className="size-3" aria-hidden />
      chybí: {missing.slice(0, 2).join(", ")}
      {missing.length > 2 && ` +${missing.length - 2}`}
    </span>
  );
}

// --- Cost basis helper ---

function computeCostBasis(
  draft: DraftRow,
  defaultWeightG: number | null | undefined,
  bundleLine: BundleLineInfo | null,
): number | null {
  if (!bundleLine) return null;
  const weight = draft.weightG ?? defaultWeightG ?? null;
  if (!weight) return null;
  return (bundleLine.pricePerKg / 1000) * weight;
}

function marginColor(pct: number): string {
  if (pct > 50) return "text-emerald-700";
  if (pct >= 20) return "text-amber-700";
  return "text-red-600";
}

// --- Timings stats (J10-B5) ---

interface TimingPiece {
  draftId: string | null;
  startedAt: string;
  submittedAt: string;
  durationMs: number;
}

function parseTimings(raw: string): { sessionStart: string | null; pieces: TimingPiece[] } {
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return { sessionStart: null, pieces: [] };
    const sessionStart =
      typeof (v as { sessionStart?: unknown }).sessionStart === "string"
        ? ((v as { sessionStart: string }).sessionStart)
        : null;
    const piecesRaw = (v as { pieces?: unknown }).pieces;
    if (!Array.isArray(piecesRaw)) return { sessionStart, pieces: [] };
    const pieces: TimingPiece[] = [];
    for (const p of piecesRaw) {
      if (!p || typeof p !== "object") continue;
      const r = p as Record<string, unknown>;
      const startedAt = typeof r.startedAt === "string" ? r.startedAt : null;
      const submittedAt = typeof r.submittedAt === "string" ? r.submittedAt : null;
      const durationMs =
        typeof r.durationMs === "number" && Number.isFinite(r.durationMs)
          ? r.durationMs
          : null;
      if (!startedAt || !submittedAt || durationMs === null) continue;
      const draftId = typeof r.draftId === "string" ? r.draftId : null;
      pieces.push({ draftId, startedAt, submittedAt, durationMs });
    }
    return { sessionStart, pieces };
  } catch {
    return { sessionStart: null, pieces: [] };
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds - minutes * 60);
  return remainder === 0 ? `${minutes} min` : `${minutes} min ${remainder} s`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function TimingsStats({ timingsJson }: { timingsJson: string }) {
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => {
    const { pieces } = parseTimings(timingsJson);
    if (pieces.length === 0) return null;
    const durations = pieces.map((p) => p.durationMs);
    const med = median(durations);
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const goalHit = med <= 30_000;
    return { count: pieces.length, median: med, min, max, goalHit };
  }, [timingsJson]);

  if (!stats) return null;

  return (
    <div className="mt-3 rounded-md border bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" aria-hidden />
          Statistiky · {stats.count}{" "}
          {stats.count === 1 ? "kousek" : stats.count < 5 ? "kousky" : "kousků"} ·
          medián {formatDuration(stats.median)}/kus
          <span
            className={
              stats.goalHit ? "text-emerald-700" : "text-amber-700"
            }
          >
            {stats.goalHit ? "✓ pod 30 s" : "nad 30 s"}
          </span>
        </span>
        {open ? (
          <ChevronUp className="size-3.5" aria-hidden />
        ) : (
          <ChevronDown className="size-3.5" aria-hidden />
        )}
      </button>
      {open && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t bg-background/60 px-3 py-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Počet kousků</dt>
            <dd className="font-medium text-foreground">{stats.count}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Medián / kus</dt>
            <dd className="font-medium text-foreground">
              {formatDuration(stats.median)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nejrychlejší</dt>
            <dd className="font-medium text-emerald-700">
              {formatDuration(stats.min)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Nejpomalejší</dt>
            <dd className="font-medium text-amber-700">
              {formatDuration(stats.max)}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

// ============================================================================
// Main client component
// ============================================================================

export function BatchReviewClient({
  batchId,
  status,
  sealedAt,
  createdAt,
  defaultWeightG,
  timingsJson,
  drafts: initialDrafts,
  categories,
  bundle,
  bundleLine,
}: BatchReviewClientProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [errorByDraft, setErrorByDraft] = useState<Record<string, string>>({});
  const [isBulkPublishing, startBulkPublish] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [, startPollingTransition] = useTransition();

  // 2-pane: which draft is shown in right panel
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Checkbox selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk edit dialog
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [bulkDiscount, setBulkDiscount] = useState<string>("");
  const [isBulkApplying, startBulkApply] = useTransition();
  const [isBulkAiFilling, setIsBulkAiFilling] = useState(false);
  const [bulkAiResult, setBulkAiResult] = useState<string | null>(null);

  // Mobile QR sheet
  const [qrSheetOpen, setQrSheetOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  // Manager drawer
  const [managerSheetOpen, setManagerSheetOpen] = useState(false);

  const visibleDrafts = useMemo(
    () => drafts.filter((d) => d.status !== "discarded"),
    [drafts],
  );

  const pendingDrafts = useMemo(
    () => visibleDrafts.filter((d) => d.status === "pending" || d.status === "ready"),
    [visibleDrafts],
  );

  // Poll for new drafts every 15s — handles Janička adding from mobile while bectly reviews on PC
  useEffect(() => {
    if (status === "published") return;
    const interval = setInterval(() => {
      startPollingTransition(() => {
        router.refresh();
      });
    }, 15_000);
    return () => clearInterval(interval);
  }, [status, router, startPollingTransition]);

  // Merge incoming server drafts into local state. Local edits go through
  // commitField (which writes to server before patching local), so local rows
  // are canonical for field values. We pull two things from the server:
  //   1. Brand-new drafts (added from mobile while bectly reviews on PC)
  //   2. Status / publishedProductId changes (e.g. another tab published)
  // Existing local field values are preserved — uncommitted text in inputs
  // stays put because Inputs use defaultValue and don't read from state.
  useEffect(() => {
    setDrafts((prev) => {
      const localById = new Map(prev.map((d) => [d.id, d]));
      const serverIds = new Set(initialDrafts.map((d) => d.id));
      let changed = false;
      const next: DraftRow[] = [];

      for (const server of initialDrafts) {
        const local = localById.get(server.id);
        if (!local) {
          next.push(server);
          changed = true;
        } else if (
          local.status !== server.status ||
          local.publishedProductId !== server.publishedProductId
        ) {
          next.push({
            ...local,
            status: server.status,
            publishedProductId: server.publishedProductId,
          });
          changed = true;
        } else {
          next.push(local);
        }
      }

      // Drop local drafts that no longer exist server-side (deleted elsewhere)
      if (prev.some((d) => !serverIds.has(d.id))) changed = true;

      return changed ? next : prev;
    });
  }, [initialDrafts]);

  // Set default active draft on first render
  useEffect(() => {
    if (activeDraftId === null && visibleDrafts.length > 0) {
      setActiveDraftId(visibleDrafts[0].id);
    }
  }, [activeDraftId, visibleDrafts]);

  // If active draft gets removed, move to first available
  useEffect(() => {
    if (activeDraftId && !visibleDrafts.find((d) => d.id === activeDraftId)) {
      setActiveDraftId(visibleDrafts[0]?.id ?? null);
    }
  }, [activeDraftId, visibleDrafts]);

  const activeDraft = visibleDrafts.find((d) => d.id === activeDraftId) ?? null;

  const selectedPending = useMemo(
    () => pendingDrafts.filter((d) => selected.has(d.id)),
    [pendingDrafts, selected],
  );

  const publishableSelected = useMemo(
    () => selectedPending.filter((d) => scoreDraft(d).complete),
    [selectedPending],
  );

  const hasIncompleteSelected =
    selectedPending.length > 0 && selectedPending.some((d) => !scoreDraft(d).complete);

  function patchDraft(id: string, patch: Partial<DraftRow>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function clearError(id: string) {
    setErrorByDraft((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function setError(id: string, msg: string) {
    setErrorByDraft((prev) => ({ ...prev, [id]: msg }));
  }

  // Selection helpers
  function selectAll() {
    setSelected(new Set(pendingDrafts.map((d) => d.id)));
  }
  function selectNone() {
    setSelected(new Set());
  }
  function selectComplete() {
    setSelected(new Set(pendingDrafts.filter((d) => scoreDraft(d).complete).map((d) => d.id)));
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkPublishSelected() {
    setGlobalError(null);
    setErrorByDraft({});
    const ids = publishableSelected.map((d) => d.id);
    if (ids.length === 0) return;
    startBulkPublish(async () => {
      try {
        const result = await publishDraftsAction(batchId, ids);
        setDrafts((prev) =>
          prev.map((d) =>
            result.publishedIds.includes(d.id) ? { ...d, status: "published" } : d,
          ),
        );
        const errs: Record<string, string> = {};
        for (const e of result.errors) errs[e.draftId] = e.reason;
        setErrorByDraft(errs);
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of result.publishedIds) next.delete(id);
          return next;
        });
        if (result.errors.length === 0) router.refresh();
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : "Hromadná publikace selhala");
      }
    });
  }

  function handleDeleteBatch() {
    if (!confirm(`Smazat celý batch se všemi kousky (${visibleDrafts.length})?`)) return;
    startDelete(async () => {
      try {
        await deleteBatchAction(batchId);
        router.push("/admin/drafts");
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : "Smazání selhalo");
      }
    });
  }

  function handleBulkApply() {
    const discountNum = bulkDiscount.trim() === "" ? null : Number(bulkDiscount);
    const validDiscount =
      discountNum != null && !Number.isNaN(discountNum) && discountNum > 0 && discountNum < 100
        ? discountNum
        : null;
    if (!bulkCategory && validDiscount == null) {
      setBulkDialogOpen(false);
      return;
    }
    startBulkApply(async () => {
      try {
        const ids = Array.from(selected);
        const result = await bulkUpdateDraftsAction(batchId, ids, {
          categoryId: bulkCategory || undefined,
          discountPct: validDiscount ?? undefined,
        });
        setDrafts((prev) =>
          prev.map((d) => {
            if (!ids.includes(d.id)) return d;
            const next = { ...d };
            if (bulkCategory) next.categoryId = bulkCategory;
            if (validDiscount != null && d.price != null && d.price > 0) {
              const original = d.compareAt ?? d.price;
              next.price = Math.max(1, Math.round(d.price * (1 - validDiscount / 100)));
              next.compareAt = d.compareAt ?? original;
            }
            return next;
          }),
        );
        setBulkDialogOpen(false);
        setBulkCategory("");
        setBulkDiscount("");
        router.refresh();
        alert(`Aktualizováno ${result.updatedCount} kousků`);
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : "Hromadná aktualizace selhala");
        setBulkDialogOpen(false);
      }
    });
  }

  async function handleOpenQrSheet() {
    setQrSheetOpen(true);
    if (qrUrl && qrExpiresAt && new Date(qrExpiresAt).getTime() > Date.now()) return;
    setIsLoadingQr(true);
    setQrError(null);
    try {
      const result = await reopenBatchAction(batchId);
      setQrUrl(result.qrUrl);
      setQrExpiresAt(result.expiresAt);
      router.refresh();
    } catch (err) {
      setQrError(err instanceof Error ? err.message : "Nepodařilo se vytvořit QR kód");
    } finally {
      setIsLoadingQr(false);
    }
  }

  async function handleBulkAiFill() {
    setBulkAiResult(null);
    setIsBulkAiFilling(true);
    try {
      const ids = Array.from(selected);
      const res = await fetch("/api/admin/ai/draft-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftIds: ids, batchId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        results: Array<{
          draftId: string;
          description: string;
          metaTitle: string;
          metaDescription: string;
        }>;
      };
      setDrafts((prev) =>
        prev.map((d) => {
          const fill = data.results.find((r) => r.draftId === d.id);
          if (!fill) return d;
          return {
            ...d,
            description: fill.description,
            metaTitle: fill.metaTitle,
            metaDescription: fill.metaDescription,
          };
        }),
      );
      setBulkAiResult(`Vyplněno ${data.results.length} kousků`);
    } catch (err) {
      setBulkAiResult(
        `Chyba: ${err instanceof Error ? err.message : "AI vyplnění selhalo"}`,
      );
    } finally {
      setIsBulkAiFilling(false);
    }
  }

  const managerUrl = useMemo(() => {
    const ids = pendingDrafts.map((d) => d.id).join(",");
    return `/admin/manager?batchId=${encodeURIComponent(batchId)}${
      ids ? `&drafts=${encodeURIComponent(ids)}` : ""
    }`;
  }, [batchId, pendingDrafts]);

  const publishButtonDisabled =
    isBulkPublishing ||
    selectedPending.length === 0 ||
    hasIncompleteSelected;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="border-b bg-card px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl font-bold text-foreground">
                Batch #{batchId.slice(-6).toUpperCase()}
              </h1>
              <StatusBadge status={status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Vytvořeno {formatDateTime(createdAt)}
              {sealedAt && (
                <>
                  {" · "}
                  Janička dokončila {formatDateTime(sealedAt)}
                </>
              )}
              {" · "}
              {visibleDrafts.length}{" "}
              {visibleDrafts.length === 1
                ? "kousek"
                : visibleDrafts.length < 5
                  ? "kousky"
                  : "kousků"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Selection controls */}
            {pendingDrafts.length > 0 && (
              <div className="flex items-center gap-1 rounded-md border bg-background px-2 py-1">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Vybrat vše
                </button>
                <span className="text-muted-foreground/50">·</span>
                <button
                  type="button"
                  onClick={selectNone}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Žádný
                </button>
                <span className="text-muted-foreground/50">·</span>
                <button
                  type="button"
                  onClick={selectComplete}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Star className="size-3" aria-hidden />
                  Jen kompletní
                </button>
              </div>
            )}
            {selected.size >= 2 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkAiResult(null);
                  setBulkDialogOpen(true);
                }}
              >
                <Sparkles className="size-3.5" />
                Hromadně upravit ({selected.size})
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleOpenQrSheet()}
              disabled={status === "published"}
            >
              <Smartphone className="size-3.5" />
              Z mobilu
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setManagerSheetOpen(true)}
              disabled={visibleDrafts.length === 0}
            >
              <MessageCircle className="size-3.5" />
              Manažerka
            </Button>
            {status !== "published" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeleteBatch}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive"
              >
                {isDeleting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="size-3.5" aria-hidden />
                )}
                Smazat batch
              </Button>
            )}
            <div className="relative">
              <Button
                type="button"
                size="sm"
                onClick={handleBulkPublishSelected}
                disabled={publishButtonDisabled}
              >
                {isBulkPublishing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-3.5" aria-hidden />
                )}
                Publikovat vybrané ({publishableSelected.length})
              </Button>
              {hasIncompleteSelected && (
                <p className="absolute right-0 top-full z-10 mt-1 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-amber-700 shadow-sm">
                  Nejprve dokonči neúplné kousky
                </p>
              )}
            </div>
          </div>
        </div>

        {globalError && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {globalError}
          </div>
        )}

        <TimingsStats timingsJson={timingsJson} />
      </header>

      {/* Bulk edit dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hromadné úpravy ({selected.size} kousků)</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Category */}
            <div className="space-y-1.5">
              <Label htmlFor="bulk-category">Kategorie</Label>
              <select
                id="bulk-category"
                value={bulkCategory}
                onChange={(e) => setBulkCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">— ponechat beze změny —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Discount % */}
            <div className="space-y-1.5">
              <Label htmlFor="bulk-discount">Sleva (%)</Label>
              <Input
                id="bulk-discount"
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={bulkDiscount}
                onChange={(e) => setBulkDiscount(e.target.value)}
                placeholder="např. 20"
              />
              <p className="text-xs text-muted-foreground">
                Sníží cenu a původní cenu zachová jako přeškrtnutou.
              </p>
            </div>

            {/* AI fill */}
            <div className="space-y-1.5">
              <Label>Auto-vyplnit popis přes AI</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBulkAiFill}
                disabled={isBulkAiFilling}
                className="w-full"
              >
                {isBulkAiFilling ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
                Auto-vyplnit popis přes AI
              </Button>
              {bulkAiResult && (
                <p className="text-xs text-muted-foreground">{bulkAiResult}</p>
              )}
            </div>
          </div>

          <DialogFooter showCloseButton>
            <Button
              type="button"
              onClick={handleBulkApply}
              disabled={isBulkApplying || (!bulkCategory && !bulkDiscount.trim())}
            >
              {isBulkApplying && (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              )}
              Použít
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Sheet — Z mobilu */}
      <Sheet open={qrSheetOpen} onOpenChange={setQrSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Smartphone className="size-4" aria-hidden />
              Přidat z mobilu
            </SheetTitle>
            <SheetDescription>
              Naskenuj QR telefonem Janičky — otevře se mobilní formulář a kousky se přidají
              do tohoto batche. Odkaz platí 15 minut.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {isLoadingQr && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" aria-hidden />
              </div>
            )}
            {qrError && !isLoadingQr && (
              <div
                role="alert"
                className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive"
              >
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {qrError}
              </div>
            )}
            {qrUrl && !isLoadingQr && (
              <div className="space-y-3">
                <div className="flex justify-center rounded-xl bg-white p-4 ring-1 ring-foreground/10">
                  <QRCodeSVG
                    value={qrUrl}
                    size={208}
                    level="M"
                    marginSize={2}
                    aria-label="QR kód pro mobilní přidávání"
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Po naskenování přidávej dál — nové kousky se objeví v levém panelu.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => void handleOpenQrSheet()}
                >
                  Vygenerovat nový QR kód
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Manager Sheet — side drawer */}
      <Sheet open={managerSheetOpen} onOpenChange={setManagerSheetOpen}>
        <SheetContent
          side="right"
          className="w-full p-0 sm:max-w-[480px]"
        >
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              <MessageCircle className="size-4" aria-hidden />
              Manažerka
            </SheetTitle>
            <SheetDescription>
              Konzultace s AI manažerkou nad vybranými kousky.
            </SheetDescription>
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                render={
                  <Link href={managerUrl} target="_blank" rel="noopener noreferrer" />
                }
              >
                Otevřít v nové záložce
                <ExternalLink className="size-3.5" aria-hidden />
              </Button>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <iframe
              src={managerUrl}
              title="Manažerka"
              className="h-full w-full border-0"
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Body */}
      {visibleDrafts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
          <div className="rounded-lg border border-dashed bg-muted/30 p-8">
            V tomto batchi nejsou žádné kousky. Pokud Janička právě přidává, počkej na sealnutí
            — nebo otevři{" "}
            <Link href="/admin/products" className="underline">
              seznam produktů
            </Link>
            .
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden lg:flex-row flex-col">
          {/* LEFT PANEL — 320px on desktop, full-width stacked on mobile */}
          <aside className="w-full shrink-0 overflow-y-auto border-r bg-background lg:w-80">
            <div className="space-y-0.5 p-2">
              {visibleDrafts.map((draft, idx) => {
                const isActive = draft.id === activeDraftId;
                const isPending =
                  draft.status === "pending" || draft.status === "ready";
                const isPublished = draft.status === "published";

                return (
                  <button
                    key={draft.id}
                    type="button"
                    onClick={() => setActiveDraftId(draft.id)}
                    className={`group w-full rounded-lg px-3 py-2 text-left transition-colors ${
                      isActive
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "hover:bg-muted/60"
                    } ${isPublished ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Checkbox — only for pending drafts */}
                      {isPending ? (
                        <span
                          role="checkbox"
                          aria-checked={selected.has(draft.id)}
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(draft.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleSelect(draft.id);
                            }
                          }}
                          className="mt-0.5 shrink-0 cursor-pointer text-muted-foreground hover:text-primary focus:outline-none"
                        >
                          {selected.has(draft.id) ? (
                            <CheckSquare className="size-4 text-primary" aria-hidden />
                          ) : (
                            <Square className="size-4" aria-hidden />
                          )}
                        </span>
                      ) : (
                        <span className="mt-0.5 size-4 shrink-0" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="truncate text-sm font-medium">
                            {idx + 1}. {draft.name ?? "Bez názvu"}
                          </span>
                          {draft.price != null ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {draft.price} Kč
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {[draft.brand, draft.sizes[0]].filter(Boolean).join(" · ") || "—"}
                        </div>
                        <div className="mt-1">
                          {isPublished ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                              <Check className="size-3" aria-hidden />
                              publikováno
                            </span>
                          ) : (
                            <CompleteBadge draft={draft} />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* RIGHT PANEL — flex-1 */}
          <main className="flex-1 overflow-y-auto p-4">
            {activeDraft ? (
              <DraftDetail
                key={activeDraft.id}
                index={visibleDrafts.findIndex((d) => d.id === activeDraft.id) + 1}
                total={visibleDrafts.length}
                draft={activeDraft}
                categories={categories}
                errorMessage={errorByDraft[activeDraft.id] ?? null}
                disabled={isBulkPublishing}
                defaultWeightG={defaultWeightG ?? null}
                bundleLine={bundleLine}
                bundle={bundle}
                onPatch={(patch) => patchDraft(activeDraft.id, patch)}
                onClearError={() => clearError(activeDraft.id)}
                onSetError={(msg) => setError(activeDraft.id, msg)}
                batchId={batchId}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Vyber kousek vlevo
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_BADGES[status] ?? STATUS_BADGES.open;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

// ============================================================================
// Draft detail (right panel)
// ============================================================================

interface DraftDetailProps {
  index: number;
  total: number;
  draft: DraftRow;
  categories: Category[];
  errorMessage: string | null;
  disabled: boolean;
  defaultWeightG: number | null;
  bundleLine: BundleLineInfo | null;
  bundle: BundleInfo | null;
  onPatch: (patch: Partial<DraftRow>) => void;
  onClearError: () => void;
  onSetError: (msg: string) => void;
  batchId: string;
}

function DraftDetail({
  index,
  total,
  draft,
  categories,
  errorMessage,
  disabled,
  defaultWeightG,
  bundleLine,
  bundle,
  onPatch,
  onClearError,
  onSetError,
  batchId,
}: DraftDetailProps) {
  const [isSaving, startSave] = useTransition();
  const [isPublishing, startPublish] = useTransition();
  const [isDiscarding, startDiscard] = useTransition();
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!showSaved) return;
    const id = window.setTimeout(() => setShowSaved(false), 2_000);
    return () => window.clearTimeout(id);
  }, [showSaved]);

  const isPublished = draft.status === "published";
  const cardDisabled = disabled || isPublished;

  // Cost basis + margin
  const costBasisValue = computeCostBasis(draft, defaultWeightG, bundleLine);
  const marginPct =
    costBasisValue != null && draft.price != null && draft.price > 0
      ? Math.round(((draft.price - costBasisValue) / draft.price) * 100)
      : null;

  function commitField<K extends keyof DraftRow>(field: K, value: DraftRow[K]) {
    if (cardDisabled) return;
    if (draft[field] === value) return;
    onPatch({ [field]: value } as Partial<DraftRow>);
    onClearError();
    startSave(async () => {
      try {
        const patch: Record<string, unknown> = {};
        if (field === "sizes") {
          patch.sizes = value as string[];
        } else if (field === "price") {
          patch.price = value as number | null;
        } else {
          patch[field as string] = value;
        }
        await updateDraftAction(batchId, draft.id, patch);
        setShowSaved(true);
      } catch (err) {
        onSetError(err instanceof Error ? err.message : "Uložení změny selhalo");
      }
    });
  }

  function toggleSize(size: string) {
    const next = draft.sizes.includes(size)
      ? draft.sizes.filter((s) => s !== size)
      : [...draft.sizes, size];
    commitField("sizes", next);
  }

  function handlePublish() {
    onClearError();
    startPublish(async () => {
      try {
        const result = await publishDraftsAction(batchId, [draft.id]);
        if (result.publishedIds.includes(draft.id)) {
          onPatch({ status: "published" });
        } else if (result.errors.length > 0) {
          onSetError(result.errors[0].reason);
        }
      } catch (err) {
        onSetError(err instanceof Error ? err.message : "Publikace selhala");
      }
    });
  }

  function handleDiscard() {
    if (!confirm("Opravdu zahodit tento kousek?")) return;
    onClearError();
    startDiscard(async () => {
      try {
        await discardDraftAction(batchId, draft.id);
        onPatch({ status: "discarded" });
      } catch (err) {
        onSetError(err instanceof Error ? err.message : "Zahodit se nepodařilo");
      }
    });
  }

  return (
    <article className={`space-y-4 ${isPublished ? "opacity-70" : ""}`}>
      {/* Draft header */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold text-muted-foreground">
          Draft {index}/{total}
          {isSaving && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
              <Loader2 className="size-3 animate-spin" aria-hidden />
              ukládám…
            </span>
          )}
          {showSaved && !isSaving && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-emerald-700">
              <Check className="size-3" aria-hidden />
              uloženo
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {isPublished && draft.publishedProductId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              render={<Link href={`/admin/products/${draft.publishedProductId}`} />}
            >
              Otevřít produkt
              <ExternalLink className="size-3.5" aria-hidden />
            </Button>
          )}
          {!isPublished && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDiscard}
              disabled={cardDisabled || isDiscarding}
              className="text-muted-foreground hover:text-destructive"
            >
              {isDiscarding ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-3.5" aria-hidden />
              )}
              Zahodit
            </Button>
          )}
        </div>
      </div>

      {/* Images + fields grid */}
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <DraftImages images={draft.images} />

        <div className="space-y-3">
          {/* Name + Price */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-name`}>Název</Label>
              <Input
                id={`${draft.id}-name`}
                defaultValue={draft.name ?? ""}
                placeholder="Dámský svetr Zara"
                disabled={cardDisabled}
                onBlur={(e) => commitField("name", e.target.value.trim() || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-price`}>Cena (Kč)</Label>
              <Input
                id={`${draft.id}-price`}
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={draft.price ?? ""}
                placeholder="299"
                disabled={cardDisabled}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  const num = v === "" ? null : Number(v);
                  commitField(
                    "price",
                    num != null && !Number.isNaN(num) && num >= 0 ? num : null,
                  );
                }}
              />
              {marginPct !== null && (
                <p className={`text-xs ${marginColor(marginPct)}`}>
                  Zisk ~{Math.round((draft.price ?? 0) - (costBasisValue ?? 0))} Kč ({marginPct}%)
                </p>
              )}
            </div>
          </div>

          {/* Brand + Category */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-brand`}>Značka</Label>
              <Input
                id={`${draft.id}-brand`}
                defaultValue={draft.brand ?? ""}
                placeholder="Zara, H&M…"
                disabled={cardDisabled}
                onBlur={(e) => commitField("brand", e.target.value.trim() || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-category`}>Kategorie</Label>
              <select
                id={`${draft.id}-category`}
                value={draft.categoryId ?? ""}
                disabled={cardDisabled}
                onChange={(e) => commitField("categoryId", e.target.value || null)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">— vybrat kategorii —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Condition + Sizes */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-condition`}>Stav</Label>
              <select
                id={`${draft.id}-condition`}
                value={draft.condition ?? "excellent"}
                disabled={cardDisabled}
                onChange={(e) => commitField("condition", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Velikosti</Label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_SIZES.map((size) => {
                  const active = draft.sizes.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={cardDisabled}
                      onClick={() => toggleSize(size)}
                      aria-pressed={active}
                      className={`flex h-8 min-w-9 items-center justify-center rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Compare at + Featured */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${draft.id}-compareAt`}>Původní cena (Kč)</Label>
              <Input
                id={`${draft.id}-compareAt`}
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={draft.compareAt ?? ""}
                placeholder="499"
                disabled={cardDisabled}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  const num = v === "" ? null : Number(v);
                  commitField("compareAt", num != null && !Number.isNaN(num) && num >= 0 ? num : null);
                }}
              />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  disabled={cardDisabled}
                  onChange={(e) => commitField("featured", e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Doporučeno na homepage
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor={`${draft.id}-description`}>Popis</Label>
            <Textarea
              id={`${draft.id}-description`}
              defaultValue={draft.description ?? ""}
              rows={2}
              placeholder="Krátký popis kousku (volitelné — pokud chybí, použije se název)."
              disabled={cardDisabled}
              onBlur={(e) => commitField("description", e.target.value.trim() || null)}
            />
          </div>

          {/* Defects / fit note */}
          {(draft.defectsNote || draft.fitNote) && (
            <dl className="grid gap-1 rounded-md bg-muted/40 p-2 text-xs">
              {draft.defectsNote && (
                <div className="flex gap-2">
                  <dt className="font-semibold text-muted-foreground">Vady:</dt>
                  <dd>{draft.defectsNote}</dd>
                </div>
              )}
              {draft.fitNote && (
                <div className="flex gap-2">
                  <dt className="font-semibold text-muted-foreground">Střih:</dt>
                  <dd>{draft.fitNote}</dd>
                </div>
              )}
            </dl>
          )}

          {/* Bundle cost basis section */}
          {bundleLine && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <p className="mb-1.5 font-semibold text-muted-foreground">Z balíčku</p>
              {bundle && (
                <p className="text-foreground">
                  Balíček:{" "}
                  <Link
                    href={`/admin/bundles/${bundle.id}`}
                    className="underline hover:text-primary"
                  >
                    {bundle.name}
                  </Link>
                </p>
              )}
              <p className="text-muted-foreground">Kategorie: {bundleLine.name}</p>
              {costBasisValue !== null && (
                <p className="text-muted-foreground">
                  Kupní cena:{" "}
                  <span className="font-medium text-foreground">
                    ~{costBasisValue.toFixed(0)} Kč
                  </span>{" "}
                  (při {draft.weightG ?? defaultWeightG}g,{" "}
                  {bundleLine.pricePerKg.toFixed(0)} Kč/kg)
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Label htmlFor={`${draft.id}-weightG`} className="shrink-0 text-xs">
                  Váha kusu (g)
                </Label>
                <Input
                  id={`${draft.id}-weightG`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={draft.weightG ?? ""}
                  placeholder={defaultWeightG != null ? String(defaultWeightG) : ""}
                  disabled={cardDisabled}
                  className="h-7 w-24 text-xs"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    const num = v === "" ? null : Number(v);
                    commitField(
                      "weightG",
                      num != null && !Number.isNaN(num) && num > 0 ? num : null,
                    );
                  }}
                />
              </div>
            </div>
          )}

          {/* SEO + Video — collapsed */}
          <details className="rounded-md border border-border">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              SEO + Video
            </summary>
            <div className="space-y-3 border-t border-border px-3 pb-3 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor={`${draft.id}-metaTitle`}>Meta název</Label>
                <Input
                  id={`${draft.id}-metaTitle`}
                  defaultValue={draft.metaTitle ?? ""}
                  placeholder="Výstižný název pro vyhledávače"
                  disabled={cardDisabled}
                  onBlur={(e) => commitField("metaTitle", e.target.value.trim() || null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${draft.id}-metaDescription`}>Meta popis</Label>
                <Textarea
                  id={`${draft.id}-metaDescription`}
                  defaultValue={draft.metaDescription ?? ""}
                  rows={2}
                  maxLength={160}
                  placeholder="Max. 160 znaků"
                  disabled={cardDisabled}
                  onBlur={(e) => commitField("metaDescription", e.target.value.trim() || null)}
                />
                <p className="text-right text-xs text-muted-foreground">
                  {(draft.metaDescription ?? "").length}/160
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${draft.id}-videoUrl`}>Video URL</Label>
                <Input
                  id={`${draft.id}-videoUrl`}
                  type="url"
                  defaultValue={draft.videoUrl ?? ""}
                  placeholder="https://..."
                  disabled={cardDisabled}
                  onBlur={(e) => commitField("videoUrl", e.target.value.trim() || null)}
                />
              </div>
            </div>
          </details>

          {/* Error */}
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {errorMessage}
            </div>
          )}

          {/* Publish button */}
          {!isPublished && (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handlePublish}
                disabled={cardDisabled || isPublishing || isSaving}
              >
                {isPublishing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-3.5" aria-hidden />
                )}
                Publikovat tento kousek
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function DraftImages({ images }: { images: string[] }) {
  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed bg-muted/30 text-xs text-muted-foreground">
        Bez fotek
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border bg-muted">
        <Image
          src={images[0]}
          alt="Hlavní foto"
          fill
          className="object-cover"
          sizes="160px"
        />
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-3 gap-1">
          {images.slice(1, 4).map((url, idx) => (
            <div
              key={url}
              className="relative aspect-square overflow-hidden rounded border bg-muted"
            >
              <Image
                src={url}
                alt={`Foto ${idx + 2}`}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
          ))}
        </div>
      )}
      {images.length > 4 && (
        <p className="text-center text-xs text-muted-foreground">
          +{images.length - 4} dalších
        </p>
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Prague",
    });
  } catch {
    return iso;
  }
}
