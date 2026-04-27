"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Check,
  X,
  Ruler,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONDITION_LABELS } from "@/lib/constants";
import { uploadFiles } from "@/lib/upload-client";
import { compressPhoto, runWithLimit } from "@/lib/image-compress";

interface MobileAddFormProps {
  batchId: string;
}

const QUICK_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const MEASUREMENTS = [
  ["chest", "Prsa"],
  ["waist", "Pas"],
  ["hips", "Boky"],
  ["length", "Délka"],
] as const;

type Measurements = Partial<Record<(typeof MEASUREMENTS)[number][0], string>>;

interface DraftPayload {
  name: string;
  price: number | null;
  brand: string;
  condition: string;
  sizes: string[];
  images: string[];
  description?: string;
  defectsNote?: string;
  measurements?: Measurements;
}

const EMPTY_MEASUREMENTS: Measurements = {};

export function MobileAddForm({ batchId }: MobileAddFormProps) {
  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [condition, setCondition] = useState("excellent");
  const [sizes, setSizes] = useState<string[]>([]);

  const [showExtras, setShowExtras] = useState(false);
  const [description, setDescription] = useState("");
  const [defectsNote, setDefectsNote] = useState("");
  const [measurements, setMeasurements] =
    useState<Measurements>(EMPTY_MEASUREMENTS);

  const [count, setCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [sealed, setSealed] = useState(false);

  const [isSaving, startSaving] = useTransition();
  const [isSealing, startSealing] = useTransition();

  function resetForm() {
    setImages([]);
    setName("");
    setPrice("");
    setBrand("");
    setCondition("excellent");
    setSizes([]);
    setDescription("");
    setDefectsNote("");
    setMeasurements(EMPTY_MEASUREMENTS);
    setShowExtras(false);
  }

  function toggleSize(size: string) {
    setSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = 10 - images.length;
    if (remaining <= 0) return;
    const slice = Array.from(files).slice(0, remaining);
    setIsUploading(true);
    setUploadError(null);
    try {
      const urls = await runWithLimit(slice, 3, async (file, idx) => {
        const { main, thumb } = await compressPhoto(file);
        const baseName = file.name.replace(/\.[^.]+$/, "") || `photo-${idx}`;
        const ext = main.type === "image/webp" ? "webp" : "jpg";
        const mainFile = new File([main], `${baseName}.${ext}`, {
          type: main.type,
        });
        const thumbFile = new File([thumb], `${baseName}-thumb.${ext}`, {
          type: thumb.type,
        });
        const [mainUrl] = await uploadFiles([mainFile, thumbFile]);
        return mainUrl;
      });
      setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Nahrávání selhalo");
    } finally {
      setIsUploading(false);
    }
  }

  function validate(): string | null {
    if (images.length === 0) return "Přidej alespoň jednu fotku.";
    if (!name.trim()) return "Vyplň název kousku.";
    const priceNum = Number(price);
    if (!price || Number.isNaN(priceNum) || priceNum <= 0)
      return "Vyplň cenu (větší než 0).";
    if (sizes.length === 0) return "Vyber alespoň jednu velikost.";
    return null;
  }

  function handleAddAnother() {
    const err = validate();
    if (err) {
      setSaveError(err);
      return;
    }
    setSaveError(null);

    const payload: DraftPayload = {
      name: name.trim(),
      price: Number(price),
      brand: brand.trim(),
      condition,
      sizes,
      images,
    };
    if (showExtras) {
      if (description.trim()) payload.description = description.trim();
      if (defectsNote.trim()) payload.defectsNote = defectsNote.trim();
      const cleanMeasurements: Measurements = {};
      for (const [key] of MEASUREMENTS) {
        const v = measurements[key];
        if (v && v.trim()) cleanMeasurements[key] = v.trim();
      }
      if (Object.keys(cleanMeasurements).length > 0)
        payload.measurements = cleanMeasurements;
    }

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
        setCount((c) => c + 1);
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
        {/* Photos — primary CTA */}
        <section className="space-y-2">
          <Label className="text-base font-semibold">Fotky</Label>

          {images.length > 0 && (
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
              disabled={isUploading || images.length >= 10}
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {isUploading ? (
              <>
                <Loader2 className="size-7 animate-spin" aria-hidden />
                <span>Nahrávám fotky…</span>
              </>
            ) : (
              <>
                <Camera className="size-7" aria-hidden />
                <span>Vyfotit kousek</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {images.length}/10 fotek
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

        {/* Name */}
        <section className="space-y-2">
          <Label htmlFor="m-name">Název</Label>
          <Input
            id="m-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Letní šaty Zara"
            autoComplete="off"
            className="h-12 text-base"
          />
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
            {QUICK_SIZES.map((size) => {
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

        {/* Condition */}
        <section className="space-y-2">
          <Label htmlFor="m-condition">Stav</Label>
          <select
            id="m-condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="flex h-12 w-full rounded-md border border-input bg-background px-3 text-base"
          >
            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </section>

        {/* Brand */}
        <section className="space-y-2">
          <Label htmlFor="m-brand">Značka</Label>
          <Input
            id="m-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Zara, H&M, Mango…"
            autoComplete="off"
            className="h-12 text-base"
          />
        </section>

        {/* Více polí expander */}
        <button
          type="button"
          onClick={() => setShowExtras((v) => !v)}
          aria-expanded={showExtras}
          className="flex h-12 w-full items-center justify-between rounded-lg border border-dashed border-muted-foreground/30 px-4 text-sm font-medium text-muted-foreground active:bg-muted"
        >
          <span>Více polí (popis, vady, míry)</span>
          {showExtras ? (
            <ChevronUp className="size-4" aria-hidden />
          ) : (
            <ChevronDown className="size-4" aria-hidden />
          )}
        </button>

        {showExtras && (
          <section className="space-y-4 rounded-lg border border-dashed border-muted-foreground/20 p-3">
            <div className="space-y-2">
              <Label htmlFor="m-description">Popis</Label>
              <Textarea
                id="m-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Volitelné — krátký popis kousku"
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-defects" className="flex items-center gap-2">
                <AlertTriangle
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                Vady
              </Label>
              <Textarea
                id="m-defects"
                value={defectsNote}
                onChange={(e) => setDefectsNote(e.target.value)}
                rows={2}
                placeholder="Drobná skvrna na rukávu, malá dírka u lemu…"
                className="text-base"
              />
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
          disabled={isSaving || isSealing || isUploading}
          className="h-14 w-full gap-2 text-base font-semibold"
        >
          {isSaving ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-5" aria-hidden />
          )}
          {isSaving ? "Ukládám…" : "Přidat další kousek"}
        </Button>
      </div>

      {/* Sticky HOTOVO bar — pb math accounts for iOS home indicator (env safe-area-inset-bottom) */}
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
            disabled={isSealing || isSaving || count === 0}
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
    </main>
  );
}
