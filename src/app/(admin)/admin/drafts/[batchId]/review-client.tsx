"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  MessageCircle,
  Trash2,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONDITION_LABELS } from "@/lib/constants";

import {
  discardDraftAction,
  publishDraftsAction,
  updateDraftAction,
} from "./actions";

interface DraftRow {
  id: string;
  name: string | null;
  price: number | null;
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
  status: string;
  publishedProductId: string | null;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

interface BatchReviewClientProps {
  batchId: string;
  status: string;
  sealedAt: string | null;
  createdAt: string;
  drafts: DraftRow[];
  categories: Category[];
}

const QUICK_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "34", "36", "38", "40", "42"] as const;

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  open: { label: "Otevřený", className: "bg-blue-100 text-blue-900" },
  sealed: { label: "Uzavřený", className: "bg-amber-100 text-amber-900" },
  published: { label: "Publikovaný", className: "bg-emerald-100 text-emerald-900" },
  expired: { label: "Vypršený", className: "bg-muted text-muted-foreground" },
};

export function BatchReviewClient({
  batchId,
  status,
  sealedAt,
  createdAt,
  drafts: initialDrafts,
  categories,
}: BatchReviewClientProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [errorByDraft, setErrorByDraft] = useState<Record<string, string>>({});
  const [isBulkPublishing, startBulkPublish] = useTransition();

  const visibleDrafts = useMemo(
    () => drafts.filter((d) => d.status !== "discarded"),
    [drafts],
  );

  const pendingDrafts = useMemo(
    () => visibleDrafts.filter((d) => d.status === "pending" || d.status === "ready"),
    [visibleDrafts],
  );

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

  function handleBulkPublish() {
    setGlobalError(null);
    setErrorByDraft({});
    if (pendingDrafts.length === 0) return;
    startBulkPublish(async () => {
      try {
        const result = await publishDraftsAction(batchId, "all");
        setDrafts((prev) =>
          prev.map((d) =>
            result.publishedIds.includes(d.id)
              ? { ...d, status: "published" }
              : d,
          ),
        );
        const errs: Record<string, string> = {};
        for (const e of result.errors) errs[e.draftId] = e.reason;
        setErrorByDraft(errs);
        if (result.errors.length === 0) {
          router.refresh();
        }
      } catch (err) {
        setGlobalError(
          err instanceof Error ? err.message : "Hromadná publikace selhala",
        );
      }
    });
  }

  function handleManagerHandoff() {
    const ids = pendingDrafts.map((d) => d.id).join(",");
    const url = `/admin/manager?batchId=${encodeURIComponent(batchId)}${
      ids ? `&drafts=${encodeURIComponent(ids)}` : ""
    }`;
    router.push(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              Batch #{batchId.slice(-6).toUpperCase()}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleManagerHandoff}
            disabled={visibleDrafts.length === 0}
          >
            <MessageCircle className="size-4" />
            Probrat s manažerkou
          </Button>
          <Button
            type="button"
            onClick={handleBulkPublish}
            disabled={isBulkPublishing || pendingDrafts.length === 0}
          >
            {isBulkPublishing ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            Publikovat vše ({pendingDrafts.length})
          </Button>
        </div>
      </header>

      {globalError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {globalError}
        </div>
      )}

      {visibleDrafts.length === 0 && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          V tomto batchi nejsou žádné kousky. Pokud Janička právě přidává, počkej
          na sealnutí — nebo otevři{" "}
          <Link href="/admin/products" className="underline">
            seznam produktů
          </Link>
          .
        </div>
      )}

      <div className="space-y-4">
        {visibleDrafts.map((draft, idx) => (
          <DraftCard
            key={draft.id}
            index={idx + 1}
            total={visibleDrafts.length}
            draft={draft}
            categories={categories}
            errorMessage={errorByDraft[draft.id] ?? null}
            disabled={isBulkPublishing}
            onPatch={(patch) => patchDraft(draft.id, patch)}
            onClearError={() => clearError(draft.id)}
            onSetError={(msg) => setError(draft.id, msg)}
            batchId={batchId}
          />
        ))}
      </div>
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

interface DraftCardProps {
  index: number;
  total: number;
  draft: DraftRow;
  categories: Category[];
  errorMessage: string | null;
  disabled: boolean;
  onPatch: (patch: Partial<DraftRow>) => void;
  onClearError: () => void;
  onSetError: (msg: string) => void;
  batchId: string;
}

function DraftCard({
  index,
  total,
  draft,
  categories,
  errorMessage,
  disabled,
  onPatch,
  onClearError,
  onSetError,
  batchId,
}: DraftCardProps) {
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
        onSetError(
          err instanceof Error ? err.message : "Uložení změny selhalo",
        );
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
        onSetError(
          err instanceof Error ? err.message : "Publikace selhala",
        );
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
        onSetError(
          err instanceof Error ? err.message : "Zahodit se nepodařilo",
        );
      }
    });
  }

  return (
    <article
      className={`rounded-xl border bg-card p-4 shadow-sm ${
        isPublished ? "opacity-60" : ""
      }`}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
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
              render={
                <Link href={`/admin/products/${draft.publishedProductId}`} />
              }
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
      </header>

      <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
        <DraftImages images={draft.images} />

        <div className="space-y-3">
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
            </div>
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
                  const selected = draft.sizes.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={cardDisabled}
                      onClick={() => toggleSize(size)}
                      aria-pressed={selected}
                      className={`flex h-8 min-w-9 items-center justify-center rounded-md border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        selected
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

          <div className="space-y-1.5">
            <Label htmlFor={`${draft.id}-description`}>Popis</Label>
            <Textarea
              id={`${draft.id}-description`}
              defaultValue={draft.description ?? ""}
              rows={2}
              placeholder="Krátký popis kousku (volitelné — pokud chybí, použije se název)."
              disabled={cardDisabled}
              onBlur={(e) =>
                commitField("description", e.target.value.trim() || null)
              }
            />
          </div>

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

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {errorMessage}
            </div>
          )}

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
          sizes="140px"
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
                sizes="48px"
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
    });
  } catch {
    return iso;
  }
}
