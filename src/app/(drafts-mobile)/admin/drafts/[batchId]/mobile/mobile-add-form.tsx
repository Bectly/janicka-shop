"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  CloudOff,
  Loader2,
  Mic,
  Plus,
  RefreshCw,
  Ruler,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PwaInstallBanner } from "@/components/admin/pwa-install-banner";
import { compressPhoto, runWithLimit } from "@/lib/image-compress";
import {
  getUploadQueue,
  type UploadQueueItem,
} from "@/lib/upload-queue";

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

interface MobileAddFormProps {
  batchId: string;
  categories: CategoryOption[];
}

const CONDITIONS = [
  { value: "new_with_tags", label: "Nové se štítkem" },
  { value: "new_without_tags", label: "Nové bez štítku" },
  { value: "excellent", label: "Výborný" },
  { value: "good", label: "Dobrý" },
  { value: "visible_wear", label: "Viditelné opotřebení" },
] as const;

const CLOTHES_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
const SHOE_SIZES = [
  "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46",
] as const;

const COLORS: Array<{ name: string; hex: string }> = [
  { name: "Červená", hex: "#DC2626" },
  { name: "Modrá", hex: "#2563EB" },
  { name: "Zelená", hex: "#16A34A" },
  { name: "Bílá", hex: "#FFFFFF" },
  { name: "Černá", hex: "#000000" },
  { name: "Šedá", hex: "#6B7280" },
  { name: "Hnědá", hex: "#92400E" },
  { name: "Béžová", hex: "#D2B48C" },
  { name: "Růžová", hex: "#EC4899" },
  { name: "Fialová", hex: "#8B5CF6" },
];

const MEASUREMENTS = [
  ["chest", "Hrudník"],
  ["waist", "Pas"],
  ["hips", "Boky"],
  ["length", "Délka"],
] as const;
type MeasurementKey = (typeof MEASUREMENTS)[number][0];
type Measurements = Partial<Record<MeasurementKey, string>>;

const RECENT_CATS_KEY = "janicka-mobile-recent-cats";
const RECENT_CATS_MAX = 3;
const CAT_DEFAULTS_KEY = "janicka_category_defaults";
const CAT_DEFAULTS_MIN_USES = 3;

const FIT_NOTE_MAX = 120;
const META_TITLE_MAX = 70;
const META_DESC_MAX = 160;
const VOICE_LONG_PRESS_MS = 500;

interface CategoryDefault {
  count: number;
  fitNote: string;
  measurements: Measurements;
}
type CategoryDefaultsMap = Record<string, CategoryDefault>;

interface DraftPayload {
  name: string;
  price: number | null;
  brand: string;
  condition: string;
  categoryId: string | null;
  sizes: string[];
  images: string[];
  colors?: string[];
  description?: string;
  defectsNote?: string;
  defectImages?: string[];
  measurements?: Measurements;
  fitNote?: string;
  compareAt?: number | null;
  featured?: boolean;
  internalNote?: string;
  metaTitle?: string;
  metaDescription?: string;
}

const EMPTY_MEASUREMENTS: Measurements = {};

function isShoeCategory(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return slug === "boty" || slug.startsWith("boty-");
}

function readRecentCats(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_CATS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

function writeRecentCats(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_CATS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / privacy mode errors */
  }
}

function readCategoryDefaults(): CategoryDefaultsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CAT_DEFAULTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as CategoryDefaultsMap) : {};
  } catch {
    return {};
  }
}

function writeCategoryDefaults(map: CategoryDefaultsMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CAT_DEFAULTS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Voice-to-text long-press hook
// ---------------------------------------------------------------------------

interface SpeechRecognitionLike {
  start: () => void;
  stop: () => void;
  abort: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function useVoiceLongPress() {
  const [listeningId, setListeningId] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setListeningId(null);
  }, []);

  const start = useCallback(
    (id: string, append: (text: string) => void) => {
      const Ctor = getSpeechRecognition();
      if (!Ctor) return;
      try {
        const rec = new Ctor();
        rec.lang = "cs-CZ";
        rec.continuous = false;
        rec.interimResults = false;
        rec.onresult = (e) => {
          const r = e.results;
          if (!r || r.length === 0) return;
          const first = r[0];
          if (!first || first.length === 0) return;
          const transcript = first[0]?.transcript ?? "";
          if (transcript) append(transcript);
        };
        rec.onerror = () => {
          stop();
        };
        rec.onend = () => {
          recognitionRef.current = null;
          setListeningId(null);
        };
        recognitionRef.current = rec;
        setListeningId(id);
        rec.start();
      } catch {
        stop();
      }
    },
    [stop]
  );

  const beginPress = useCallback(
    (id: string, append: (text: string) => void) => {
      if (!getSpeechRecognition()) return;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        start(id, append);
      }, VOICE_LONG_PRESS_MS);
    },
    [start]
  );

  const endPress = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const supported = getSpeechRecognition() !== null;
  return { listeningId, beginPress, endPress, supported };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MobileAddForm({ batchId, categories }: MobileAddFormProps) {
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState<string>("excellent");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);

  const [recentCatIds, setRecentCatIds] = useState<string[]>([]);
  const [catDefaults, setCatDefaults] = useState<CategoryDefaultsMap>({});

  const [showMore, setShowMore] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [description, setDescription] = useState("");
  const [defectsNote, setDefectsNote] = useState("");
  const [defectImages, setDefectImages] = useState<string[]>([]);
  const [measurements, setMeasurements] =
    useState<Measurements>(EMPTY_MEASUREMENTS);
  const [fitNote, setFitNote] = useState("");

  const [compareAt, setCompareAt] = useState("");
  const [featured, setFeatured] = useState(false);
  const [internalNote, setInternalNote] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  const [count, setCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingDefect, setIsUploadingDefect] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // J10-B2 offline upload queue. We enqueue compressed Blobs into IndexedDB, then
  // a background worker drains the queue (with retry-on-`online`). The form holds:
  //   - `queueItems`: filtered snapshot for this batch (drives banner + tiles)
  //   - mainIds/defectIds: which queue items belong to which slot (encoded via baseName prefix
  //     so the assignment survives a page reload that re-hydrates the queue)
  const [queueItems, setQueueItems] = useState<UploadQueueItem[]>([]);
  const queueRef = useRef(typeof window !== "undefined" ? getUploadQueue() : null);
  const thumbUrlsRef = useRef<Map<string, string>>(new Map());
  const handledUploadsRef = useRef<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [sealed, setSealed] = useState(false);

  // Brand autocomplete
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [brandFocused, setBrandFocused] = useState(false);

  const [isSaving, startSaving] = useTransition();
  const [isSealing, startSealing] = useTransition();

  // J10-B5 telemetry — track session + per-piece timing to validate ≤30s/piece goal.
  const sessionStartRef = useRef<string>(new Date().toISOString());
  const pieceStartRef = useRef<string>(sessionStartRef.current);
  const piecesRef = useRef<
    Array<{
      draftId: string | null;
      startedAt: string;
      submittedAt: string;
      durationMs: number;
    }>
  >([]);

  const voice = useVoiceLongPress();

  // Hydrate localStorage once on mount.
  useEffect(() => {
    setRecentCatIds(readRecentCats());
    setCatDefaults(readCategoryDefaults());
  }, []);

  // Subscribe to upload queue. Two responsibilities:
  //  1) Keep `queueItems` in sync (banner counts + tile statuses).
  //  2) On `onUploaded`, route the resulting URL into images/defectImages by slot.
  useEffect(() => {
    const q = queueRef.current;
    if (!q) return;
    const unsubA = q.subscribe((items) => {
      setQueueItems(items.filter((it) => it.batchId === batchId));
    });
    const unsubB = q.onUploaded((item) => {
      if (item.batchId !== batchId || !item.mainUrl) return;
      if (handledUploadsRef.current.has(item.id)) return;
      handledUploadsRef.current.add(item.id);
      if (item.baseName.startsWith("defect__")) {
        setDefectImages((prev) =>
          prev.includes(item.mainUrl!) ? prev : [...prev, item.mainUrl!]
        );
      } else {
        setImages((prev) =>
          prev.includes(item.mainUrl!) ? prev : [...prev, item.mainUrl!]
        );
      }
    });
    return () => {
      unsubA();
      unsubB();
    };
  }, [batchId]);

  // Revoke object URLs for queue items that have left the queue.
  useEffect(() => {
    const live = new Set(queueItems.map((it) => it.id));
    for (const [id, url] of thumbUrlsRef.current) {
      if (!live.has(id)) {
        URL.revokeObjectURL(url);
        thumbUrlsRef.current.delete(id);
      }
    }
  }, [queueItems]);

  useEffect(() => {
    const cache = thumbUrlsRef.current;
    return () => {
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

  function thumbUrlFor(item: UploadQueueItem): string {
    const cached = thumbUrlsRef.current.get(item.id);
    if (cached) return cached;
    const url = URL.createObjectURL(item.thumb);
    thumbUrlsRef.current.set(item.id, url);
    return url;
  }

  const mainQueueItems = queueItems.filter(
    (it) => !it.baseName.startsWith("defect__")
  );
  const defectQueueItems = queueItems.filter((it) =>
    it.baseName.startsWith("defect__")
  );
  const inFlightCount = queueItems.filter(
    (it) =>
      it.status === "pending" ||
      it.status === "uploading" ||
      it.status === "retry"
  ).length;
  const failedCount = queueItems.filter((it) => it.status === "failed").length;
  const hasInFlight = inFlightCount > 0;

  // Sort categories: most-recent first, then alphabetical.
  const orderedCategories = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const recent: CategoryOption[] = [];
    for (const id of recentCatIds) {
      const c = byId.get(id);
      if (c) recent.push(c);
    }
    const recentSet = new Set(recent.map((c) => c.id));
    const rest = categories.filter((c) => !recentSet.has(c.id));
    return [...recent, ...rest];
  }, [categories, recentCatIds]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId]
  );

  const sizeOptions = useMemo<readonly string[]>(
    () => (isShoeCategory(selectedCategory?.slug) ? SHOE_SIZES : CLOTHES_SIZES),
    [selectedCategory]
  );

  useEffect(() => {
    setSizes((prev) => prev.filter((s) => sizeOptions.includes(s)));
  }, [sizeOptions]);

  // Defects auto-expand for these conditions; controlled via render check, no state.
  const defectsAutoOpen = condition === "good" || condition === "visible_wear";

  // Per-category "use last values" — only show after enough uses.
  const currentCatDefault =
    categoryId && catDefaults[categoryId]?.count >= CAT_DEFAULTS_MIN_USES
      ? catDefaults[categoryId]
      : null;

  // Brand autocomplete: debounced fetch from /api/admin/brands/suggest
  useEffect(() => {
    const q = brand.trim();
    if (q.length < 1 || !brandFocused) {
      setBrandSuggestions([]);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/brands/suggest?q=${encodeURIComponent(q)}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) {
          setBrandSuggestions([]);
          return;
        }
        const data = (await res.json()) as { brands?: string[] };
        const list = Array.isArray(data.brands) ? data.brands : [];
        setBrandSuggestions(
          list.filter((b) => b.toLowerCase() !== q.toLowerCase())
        );
      } catch {
        /* aborted or network — ignore */
      }
    }, 200);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [brand, brandFocused]);

  function resetForm() {
    setImages([]);
    setName("");
    setPrice("");
    setBrand("");
    setSizes([]);
    setColors([]);
    setDescription("");
    setDefectsNote("");
    setDefectImages([]);
    setMeasurements(EMPTY_MEASUREMENTS);
    setFitNote("");
    setCompareAt("");
    setFeatured(false);
    setInternalNote("");
    setMetaTitle("");
    setMetaDescription("");
    setShowMore(false);
    setShowAdvanced(false);
    setBrandSuggestions([]);
    // intentionally NOT resetting `condition` and `categoryId` — sticky between saves
  }

  function toggleSize(size: string) {
    setSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  }

  function toggleColor(name: string) {
    setColors((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  // Compress + enqueue. Actual upload happens in the background queue; this returns
  // as soon as items are persisted to IndexedDB, so weak-signal sessions don't block
  // the user from continuing to add more pieces.
  async function compressAndEnqueue(
    files: FileList | null,
    slot: "main" | "defect",
    max: number
  ): Promise<void> {
    if (!files || files.length === 0) return;
    const queue = queueRef.current;
    if (!queue) {
      setUploadError("Frontu pro nahrávání se nepodařilo inicializovat.");
      return;
    }
    const currentUploaded =
      slot === "main" ? images.length : defectImages.length;
    const slotQueueCount =
      slot === "main" ? mainQueueItems.length : defectQueueItems.length;
    const remaining = max - currentUploaded - slotQueueCount;
    if (remaining <= 0) return;
    const slice = Array.from(files).slice(0, remaining);
    await runWithLimit(slice, 3, async (file, idx) => {
      const { main, thumb } = await compressPhoto(file);
      const safeBase = file.name.replace(/\.[^.]+$/, "") || `photo-${idx}`;
      const baseName = `${slot === "defect" ? "defect__" : "main__"}${safeBase}_${Date.now().toString(
        36
      )}_${idx}`;
      await queue.enqueue({
        batchId,
        main,
        thumb,
        baseName,
        fieldName: "files",
      });
    });
    void queue.processAll();
  }

  async function handleFiles(files: FileList | null) {
    setIsUploading(true);
    setUploadError(null);
    try {
      await compressAndEnqueue(files, "main", 10);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Komprese fotky selhala"
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDefectFiles(files: FileList | null) {
    setIsUploadingDefect(true);
    setUploadError(null);
    try {
      await compressAndEnqueue(files, "defect", 10);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Komprese fotky selhala"
      );
    } finally {
      setIsUploadingDefect(false);
    }
  }

  async function removeQueueItem(id: string) {
    const q = queueRef.current;
    if (!q) return;
    await q.remove(id);
  }

  async function retryAllFailed() {
    const q = queueRef.current;
    if (!q) return;
    await q.retryAll(batchId);
  }

  function applyCategoryDefaults() {
    if (!currentCatDefault) return;
    if (currentCatDefault.fitNote) setFitNote(currentCatDefault.fitNote);
    if (currentCatDefault.measurements) {
      setMeasurements({ ...currentCatDefault.measurements });
    }
    setShowMore(true);
  }

  function validate(): string | null {
    if (hasInFlight)
      return "Počkej, až se fotky nahrají, ať tu kus nezůstane bez obrázků.";
    if (images.length === 0) return "Přidej alespoň jednu fotku.";
    if (!name.trim()) return "Vyplň název kousku.";
    const priceNum = Number(price);
    if (!price || Number.isNaN(priceNum) || priceNum <= 0)
      return "Vyplň cenu (větší než 0).";
    if (!categoryId) return "Vyber kategorii.";
    if (sizes.length === 0) return "Vyber alespoň jednu velikost.";
    if (fitNote.length > FIT_NOTE_MAX)
      return `Padne — max ${FIT_NOTE_MAX} znaků.`;
    return null;
  }

  function buildPayload(): DraftPayload {
    const payload: DraftPayload = {
      name: name.trim(),
      price: Number(price),
      brand: brand.trim(),
      condition,
      categoryId,
      sizes,
      images,
    };
    if (colors.length > 0) payload.colors = colors;
    if (description.trim()) payload.description = description.trim();
    if (defectsNote.trim()) payload.defectsNote = defectsNote.trim();
    if (defectImages.length > 0) payload.defectImages = defectImages;
    const cleanMeas: Measurements = {};
    for (const [k] of MEASUREMENTS) {
      const v = measurements[k];
      if (v && v.trim()) cleanMeas[k] = v.trim();
    }
    if (Object.keys(cleanMeas).length > 0) payload.measurements = cleanMeas;
    if (fitNote.trim()) payload.fitNote = fitNote.trim();
    if (compareAt) {
      const n = Number(compareAt);
      if (!Number.isNaN(n) && n >= 0) payload.compareAt = n;
    }
    if (featured) payload.featured = true;
    if (internalNote.trim()) payload.internalNote = internalNote.trim();
    if (metaTitle.trim()) payload.metaTitle = metaTitle.trim();
    if (metaDescription.trim())
      payload.metaDescription = metaDescription.trim();
    return payload;
  }

  function bumpRecentCat(id: string) {
    setRecentCatIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_CATS_MAX);
      writeRecentCats(next);
      return next;
    });
  }

  function bumpCategoryDefaults(id: string) {
    setCatDefaults((prev) => {
      const cleanMeas: Measurements = {};
      for (const [k] of MEASUREMENTS) {
        const v = measurements[k];
        if (v && v.trim()) cleanMeas[k] = v.trim();
      }
      const next: CategoryDefault = {
        count: (prev[id]?.count ?? 0) + 1,
        fitNote: fitNote.trim() || prev[id]?.fitNote || "",
        measurements:
          Object.keys(cleanMeas).length > 0
            ? cleanMeas
            : prev[id]?.measurements ?? {},
      };
      const map = { ...prev, [id]: next };
      writeCategoryDefaults(map);
      return map;
    });
  }

  function handleAddAnother() {
    const err = validate();
    if (err) {
      setSaveError(err);
      return;
    }
    setSaveError(null);

    const payload = buildPayload();

    startSaving(async () => {
      try {
        const res = await fetch(`/api/admin/drafts/${batchId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Uložení se nepodařilo");
        }
        const data = (await res.json().catch(() => ({}))) as {
          draftId?: string;
        };
        const submittedAtIso = new Date().toISOString();
        const startedAtIso = pieceStartRef.current;
        const durationMs = Math.max(
          0,
          new Date(submittedAtIso).getTime() - new Date(startedAtIso).getTime()
        );
        piecesRef.current.push({
          draftId: data.draftId ?? null,
          startedAt: startedAtIso,
          submittedAt: submittedAtIso,
          durationMs,
        });
        pieceStartRef.current = submittedAtIso;
        setCount((c) => c + 1);
        if (categoryId) {
          bumpRecentCat(categoryId);
          bumpCategoryDefaults(categoryId);
        }
        resetForm();
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 1500);
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Uložení selhalo");
      }
    });
  }

  function handleSeal() {
    if (count === 0) {
      setSaveError("Nejdřív přidej aspoň jeden kousek.");
      return;
    }
    setSaveError(null);
    startSealing(async () => {
      try {
        const res = await fetch(`/api/admin/drafts/${batchId}/seal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionStart: sessionStartRef.current,
            pieces: piecesRef.current,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Uzavření batchí se nepodařilo");
        }
        setSealed(true);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Uzavření selhalo");
      }
    });
  }

  // ----- Voice mic button shared logic -----
  function micButton(id: string, append: (t: string) => void) {
    if (!voice.supported) return null;
    const isActive = voice.listeningId === id;
    return (
      <button
        type="button"
        aria-label="Diktovat (podrž)"
        aria-pressed={isActive}
        onPointerDown={() => voice.beginPress(id, append)}
        onPointerUp={voice.endPress}
        onPointerCancel={voice.endPress}
        onPointerLeave={voice.endPress}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex size-10 shrink-0 items-center justify-center rounded-md border transition-colors ${
          isActive
            ? "animate-pulse border-primary bg-primary text-primary-foreground"
            : "border-border bg-background text-muted-foreground active:bg-muted"
        }`}
      >
        <Mic className="size-4" aria-hidden />
      </button>
    );
  }

  // ----- sealed view -----
  if (sealed) {
    return (
      <main
        className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center"
        style={{
          paddingTop: "max(3rem, env(safe-area-inset-top))",
          paddingBottom: "max(3rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Check className="size-8 text-primary" aria-hidden />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Hotovo!
        </h1>
        <p className="text-sm text-muted-foreground">
          Přidala jsi {count} {count === 1 ? "kousek" : count < 5 ? "kousky" : "kousků"}.
          Bectly už je uvidí na počítači.
        </p>
      </main>
    );
  }

  return (
    <main
      className="mx-auto min-h-[100dvh] max-w-md bg-background"
      style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
    >
      <header
        className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 pb-3 backdrop-blur"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <h1 className="font-heading text-base font-semibold text-foreground">
          Janička Shop
        </h1>
        <span
          aria-label={`${count} kousků v batchi`}
          className="inline-flex min-w-12 items-center justify-center rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground"
        >
          {count}
        </span>
      </header>

      {savedFlash && (
        <div
          role="status"
          aria-live="polite"
          className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground"
        >
          <Check className="size-4 text-primary" aria-hidden />
          Kousek uložen — pokračuj dalším.
        </div>
      )}

      <div className="space-y-5 px-4 pt-4">
        {/* Upload-queue banner — only when something is queued or has failed */}
        {(inFlightCount > 0 || failedCount > 0) && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col gap-2 rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm dark:bg-amber-950/30"
          >
            <div className="flex items-center gap-2 text-foreground">
              {inFlightCount > 0 ? (
                <Loader2 className="size-4 animate-spin text-amber-700" aria-hidden />
              ) : (
                <CloudOff className="size-4 text-destructive" aria-hidden />
              )}
              <span>
                {inFlightCount > 0 && (
                  <>
                    {inFlightCount}{" "}
                    {inFlightCount === 1
                      ? "fotka čeká na nahrání"
                      : inFlightCount < 5
                      ? "fotky čekají na nahrání"
                      : "fotek čeká na nahrání"}
                  </>
                )}
                {inFlightCount > 0 && failedCount > 0 && " · "}
                {failedCount > 0 && (
                  <span className="text-destructive">
                    {failedCount}{" "}
                    {failedCount === 1
                      ? "selhala"
                      : failedCount < 5
                      ? "selhaly"
                      : "selhalo"}
                  </span>
                )}
              </span>
            </div>
            {failedCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={retryAllFailed}
                className="self-start gap-2"
              >
                <RefreshCw className="size-4" aria-hidden />
                Zkusit znovu
              </Button>
            )}
          </div>
        )}

        {/* Photos */}
        <section className="space-y-2">
          <Label className="text-base font-semibold">Fotky</Label>

          {(images.length > 0 || mainQueueItems.length > 0) && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((url, idx) => (
                <div
                  key={url}
                  className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                >
                  <Image
                    src={url}
                    alt={`Foto ${idx + 1}`}
                    fill
                    className="object-cover"
                    sizes="33vw"
                  />
                  {idx === 0 && (
                    <span className="absolute top-1 left-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      Hlavní
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setImages((prev) => prev.filter((_, i) => i !== idx))
                    }
                    aria-label={`Smazat fotku ${idx + 1}`}
                    className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {mainQueueItems.map((it) => (
                <QueueTile
                  key={it.id}
                  item={it}
                  src={thumbUrlFor(it)}
                  onRemove={() => removeQueueItem(it.id)}
                />
              ))}
            </div>
          )}

          <label
            className={`flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-base font-semibold transition-colors ${
              isUploading
                ? "cursor-default border-primary/30 bg-muted/30 text-muted-foreground"
                : "border-primary/40 bg-primary/5 text-foreground active:bg-primary/10"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              disabled={
                isUploading ||
                images.length + mainQueueItems.length >= 10
              }
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {isUploading ? (
              <>
                <Loader2 className="size-7 animate-spin" aria-hidden />
                <span>Připravuju fotky…</span>
              </>
            ) : (
              <>
                <Camera className="size-7" aria-hidden />
                <span>Vyfotit kousek</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {images.length + mainQueueItems.length}/10 fotek
                </span>
              </>
            )}
          </label>

          {uploadError && (
            <p role="alert" className="text-sm text-destructive">
              {uploadError}
            </p>
          )}
        </section>

        {/* Use last category defaults */}
        {currentCatDefault && (
          <button
            type="button"
            onClick={applyCategoryDefaults}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 text-sm font-medium text-foreground active:bg-primary/10"
          >
            <Sparkles className="size-4 text-primary" aria-hidden />
            Použít stejné jako minule ({selectedCategory?.name})
          </button>
        )}

        {/* Name */}
        <section className="space-y-2">
          <Label htmlFor="m-name">Název</Label>
          <div className="flex items-center gap-2">
            <Input
              id="m-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Letní šaty Zara"
              autoComplete="off"
              className="h-12 text-base"
            />
            {micButton("name", (t) => setName((p) => (p ? `${p} ${t}` : t)))}
          </div>
        </section>

        {/* Price */}
        <section className="space-y-2">
          <Label htmlFor="m-price">Cena (Kč)</Label>
          <Input
            id="m-price"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="490"
            className="h-12 text-base"
          />
        </section>

        {/* Sizes */}
        <section className="space-y-2">
          <Label>Velikost</Label>
          <div className="flex flex-wrap gap-2">
            {sizeOptions.map((size) => {
              const selected = sizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => toggleSize(size)}
                  aria-pressed={selected}
                  className={`flex h-12 min-w-12 items-center justify-center rounded-lg border px-4 text-base font-semibold transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground active:bg-muted"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </section>

        {/* Condition — segmented chips */}
        <section className="space-y-2">
          <Label>Stav</Label>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map(({ value, label }) => {
              const selected = condition === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCondition(value)}
                  aria-pressed={selected}
                  className={`flex h-11 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground active:bg-muted"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Defects — auto-expand for good / visible_wear */}
        {defectsAutoOpen && (
          <section className="space-y-3 rounded-lg border border-amber-300/50 bg-amber-50/50 p-3 dark:bg-amber-950/20">
            <Label
              htmlFor="m-defects"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <AlertTriangle className="size-4 text-amber-600" aria-hidden />
              Vady
            </Label>
            <div className="flex items-start gap-2">
              <Textarea
                id="m-defects"
                value={defectsNote}
                onChange={(e) => setDefectsNote(e.target.value)}
                rows={2}
                placeholder="Drobná skvrna na rukávu, malá dírka u lemu…"
                className="text-base"
              />
              {micButton("defects", (t) =>
                setDefectsNote((p) => (p ? `${p} ${t}` : t))
              )}
            </div>

            {(defectImages.length > 0 || defectQueueItems.length > 0) && (
              <div className="grid grid-cols-3 gap-2">
                {defectImages.map((url, idx) => (
                  <div
                    key={url}
                    className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
                  >
                    <Image
                      src={url}
                      alt={`Foto vady ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="33vw"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDefectImages((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      aria-label={`Smazat foto vady ${idx + 1}`}
                      className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                {defectQueueItems.map((it) => (
                  <QueueTile
                    key={it.id}
                    item={it}
                    src={thumbUrlFor(it)}
                    onRemove={() => removeQueueItem(it.id)}
                  />
                ))}
              </div>
            )}

            <label
              className={`flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm font-medium transition-colors ${
                isUploadingDefect
                  ? "cursor-default border-muted-foreground/30 bg-muted/30 text-muted-foreground"
                  : "border-amber-400/60 bg-amber-50/40 text-foreground active:bg-amber-100/60 dark:bg-amber-950/30"
              }`}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="sr-only"
                disabled={
                  isUploadingDefect ||
                  defectImages.length + defectQueueItems.length >= 10
                }
                onChange={(e) => {
                  handleDefectFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {isUploadingDefect ? (
                <>
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                  <span>Připravuju…</span>
                </>
              ) : (
                <>
                  <Camera className="size-5" aria-hidden />
                  <span>Vyfotit vadu</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {defectImages.length + defectQueueItems.length}/10
                  </span>
                </>
              )}
            </label>
          </section>
        )}

        {/* Brand with autocomplete */}
        <section className="space-y-2">
          <Label htmlFor="m-brand">Značka</Label>
          <div className="relative">
            <div className="flex items-center gap-2">
              <Input
                id="m-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                onFocus={() => setBrandFocused(true)}
                onBlur={() =>
                  window.setTimeout(() => setBrandFocused(false), 150)
                }
                placeholder="Zara, H&M, Mango…"
                autoComplete="off"
                className="h-12 text-base"
              />
              {micButton("brand", (t) => setBrand(t))}
            </div>
            {brandFocused && brandSuggestions.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-md">
                {brandSuggestions.map((b) => (
                  <li key={b}>
                    <button
                      type="button"
                      onClick={() => {
                        setBrand(b);
                        setBrandSuggestions([]);
                        setBrandFocused(false);
                      }}
                      className="flex w-full items-center px-3 py-3 text-left text-base text-foreground active:bg-muted"
                    >
                      {b}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Category — chips, recent first */}
        <section className="space-y-2">
          <Label>Kategorie</Label>
          <div className="flex flex-wrap gap-2">
            {orderedCategories.map((c) => {
              const selected = categoryId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  aria-pressed={selected}
                  className={`flex h-11 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground active:bg-muted"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Více detailů */}
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="flex h-12 w-full items-center justify-between rounded-lg border border-dashed border-muted-foreground/30 px-4 text-sm font-medium text-muted-foreground active:bg-muted"
        >
          <span>Více detailů (popis, barvy, míry, padne)</span>
          {showMore ? (
            <ChevronUp className="size-4" aria-hidden />
          ) : (
            <ChevronDown className="size-4" aria-hidden />
          )}
        </button>

        {showMore && (
          <section className="space-y-4 rounded-lg border border-dashed border-muted-foreground/20 p-3">
            <div className="space-y-2">
              <Label htmlFor="m-description">Popis</Label>
              <div className="flex items-start gap-2">
                <Textarea
                  id="m-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Volitelné — krátký popis kousku"
                  className="text-base"
                />
                {micButton("description", (t) =>
                  setDescription((p) => (p ? `${p} ${t}` : t))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Barvy</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(({ name: cname, hex }) => {
                  const selected = colors.includes(cname);
                  const lightSwatch =
                    cname === "Bílá" || cname === "Béžová";
                  return (
                    <button
                      key={cname}
                      type="button"
                      onClick={() => toggleColor(cname)}
                      aria-pressed={selected}
                      aria-label={cname}
                      title={cname}
                      className={`relative size-11 rounded-full border-2 transition-transform ${
                        selected
                          ? "border-primary scale-105"
                          : lightSwatch
                          ? "border-border"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {selected && (
                        <Check
                          className={`absolute inset-0 m-auto size-5 ${
                            lightSwatch ? "text-foreground" : "text-white"
                          }`}
                          aria-hidden
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Ruler
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                Míry (cm)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {MEASUREMENTS.map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label
                      htmlFor={`m-meas-${key}`}
                      className="text-xs text-muted-foreground"
                    >
                      {label}
                    </Label>
                    <Input
                      id={`m-meas-${key}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.5}
                      value={measurements[key] ?? ""}
                      onChange={(e) =>
                        setMeasurements((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder="cm"
                      className="h-12 text-base"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-fitnote">
                Padne ({fitNote.length}/{FIT_NOTE_MAX})
              </Label>
              <div className="flex items-start gap-2">
                <Textarea
                  id="m-fitnote"
                  value={fitNote}
                  onChange={(e) =>
                    setFitNote(e.target.value.slice(0, FIT_NOTE_MAX))
                  }
                  rows={2}
                  maxLength={FIT_NOTE_MAX}
                  placeholder="Sedí podle velikosti M, mírně volnější v pase"
                  className="text-base"
                />
                {micButton("fitnote", (t) =>
                  setFitNote((p) =>
                    (p ? `${p} ${t}` : t).slice(0, FIT_NOTE_MAX)
                  )
                )}
              </div>
            </div>
          </section>
        )}

        {/* Pro pokročilé */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
          className="flex h-12 w-full items-center justify-between rounded-lg border border-dashed border-muted-foreground/30 px-4 text-sm font-medium text-muted-foreground active:bg-muted"
        >
          <span>Pro pokročilé (sleva, SEO, interní pozn.)</span>
          {showAdvanced ? (
            <ChevronUp className="size-4" aria-hidden />
          ) : (
            <ChevronDown className="size-4" aria-hidden />
          )}
        </button>

        {showAdvanced && (
          <section className="space-y-4 rounded-lg border border-dashed border-muted-foreground/20 p-3">
            <div className="space-y-2">
              <Label htmlFor="m-compare">Původní cena (Kč)</Label>
              <Input
                id="m-compare"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={compareAt}
                onChange={(e) => setCompareAt(e.target.value)}
                placeholder="Pro zobrazení slevy"
                className="h-12 text-base"
              />
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-3 active:bg-muted">
              <span className="text-sm font-medium">
                Zvýraznit na homepage
              </span>
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="size-5 accent-primary"
              />
            </label>

            <div className="space-y-2">
              <Label htmlFor="m-internal">Interní poznámka</Label>
              <div className="flex items-start gap-2">
                <Textarea
                  id="m-internal"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  rows={2}
                  placeholder="Není veřejné — jen pro tebe a Bectlyho"
                  className="text-base"
                />
                {micButton("internal", (t) =>
                  setInternalNote((p) => (p ? `${p} ${t}` : t))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-meta-title">
                SEO titulek ({metaTitle.length}/{META_TITLE_MAX})
              </Label>
              <Input
                id="m-meta-title"
                value={metaTitle}
                onChange={(e) =>
                  setMetaTitle(e.target.value.slice(0, META_TITLE_MAX))
                }
                maxLength={META_TITLE_MAX}
                placeholder="Pro Google — volitelné"
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-meta-desc">
                SEO popis ({metaDescription.length}/{META_DESC_MAX})
              </Label>
              <Textarea
                id="m-meta-desc"
                value={metaDescription}
                onChange={(e) =>
                  setMetaDescription(e.target.value.slice(0, META_DESC_MAX))
                }
                rows={2}
                maxLength={META_DESC_MAX}
                placeholder="Pro Google — volitelné"
                className="text-base"
              />
            </div>
          </section>
        )}

        {saveError && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {saveError}
          </p>
        )}

        <Button
          type="button"
          size="lg"
          variant="default"
          onClick={handleAddAnother}
          disabled={
            isSaving || isSealing || isUploading || isUploadingDefect || hasInFlight
          }
          className="h-14 w-full gap-2 text-base font-semibold"
        >
          {isSaving ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-5" aria-hidden />
          )}
          {isSaving
            ? "Ukládám…"
            : hasInFlight
            ? "Čekám na nahrání fotek…"
            : "Přidat další kousek"}
        </Button>
      </div>

      {/* Sticky HOTOVO bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-3 pt-3 backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-md items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {count} {count === 1 ? "kousek" : count < 5 ? "kousky" : "kousků"} v
            batchi
          </span>
          <Button
            type="button"
            size="lg"
            variant="secondary"
            onClick={handleSeal}
            disabled={isSealing || isSaving || count === 0 || hasInFlight}
            className="ml-auto h-12 min-w-32 font-semibold"
          >
            {isSealing ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Check className="size-5" aria-hidden />
            )}
            HOTOVO
          </Button>
        </div>
      </div>

      <PwaInstallBanner show={count > 0} />
    </main>
  );
}

interface QueueTileProps {
  item: UploadQueueItem;
  src: string;
  onRemove: () => void;
}

function QueueTile({ item, src, onRemove }: QueueTileProps) {
  const ringClass =
    item.status === "failed"
      ? "ring-2 ring-destructive"
      : item.status === "retry"
      ? "ring-2 ring-amber-500"
      : item.status === "uploading"
      ? "ring-2 ring-amber-500/70"
      : "ring-2 ring-muted-foreground/30";

  const label =
    item.status === "uploading"
      ? "Nahrávám…"
      : item.status === "retry"
      ? `Zkouším znovu (${item.retryCount}/3)`
      : item.status === "failed"
      ? "Nahrání selhalo"
      : "Ve frontě";

  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-lg border bg-muted ${ringClass}`}
      role="status"
      aria-live="polite"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label}
        className="size-full object-cover opacity-70"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/40 text-[11px] font-medium text-foreground">
        {item.status === "uploading" || item.status === "pending" ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : item.status === "failed" ? (
          <CloudOff className="size-5 text-destructive" aria-hidden />
        ) : (
          <RefreshCw className="size-5 text-amber-600" aria-hidden />
        )}
        <span className="px-1 text-center leading-tight">{label}</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Odstranit z fronty"
        className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
