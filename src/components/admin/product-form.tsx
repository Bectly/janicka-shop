"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CONDITION_LABELS } from "@/lib/constants";
import { ImageUpload } from "@/components/admin/image-upload";
import { DefectsEditor } from "@/components/admin/defects-editor";
import { parseProductImages, parseMeasurements } from "@/lib/images";
import { parseDefectImages } from "@/lib/defects";
import type { ProductImage, ProductMeasurements } from "@/lib/images";
import { uploadFiles } from "@/lib/upload-client";
import { getSizeGroupsForCategory } from "@/lib/sizes";
import { generateProductAltText } from "@/app/(admin)/admin/products/actions";
import { Save, Ruler, Video, X, Loader2, Search, Sparkles } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductData {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAt: number | null;
  sku: string;
  categoryId: string;
  brand: string | null;
  condition: string;
  sizes: string;
  colors: string;
  featured: boolean;
  active: boolean;
  images: string;
  measurements?: string;
  defectsNote?: string | null;
  defectImages?: string;
  fitNote?: string | null;
  videoUrl?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  internalNote?: string | null;
}

interface ProductFormProps {
  categories: Category[];
  product?: ProductData;
  action: (formData: FormData) => Promise<void>;
}

export function ProductForm({ categories, product, action }: ProductFormProps) {
  // Category + sizes state (sizes depend on selected category)
  const [categoryId, setCategoryId] = useState<string>(product?.categoryId ?? "");
  const [condition, setCondition] = useState<string>(product?.condition ?? "excellent");
  const [selectedSizes, setSelectedSizes] = useState<string[]>(() => {
    if (!product?.sizes) return [];
    return product.sizes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  });

  const selectedCategorySlug = categories.find((c) => c.id === categoryId)?.slug;
  const sizeGroups = getSizeGroupsForCategory(selectedCategorySlug);
  const allowedSizesSet = new Set(sizeGroups.flatMap((g) => g.sizes));

  function toggleSize(size: string) {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size],
    );
  }

  // Parse structured images from DB (backward-compat)
  const [structuredImages, setStructuredImages] = useState<ProductImage[]>(() => {
    if (!product?.images) return [];
    return parseProductImages(product.images);
  });

  // Video URL state
  const [videoUrl, setVideoUrl] = useState<string>(product?.videoUrl ?? "");
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

  // Measurements state
  const [measurements, setMeasurements] = useState<ProductMeasurements>(() => {
    if (!product?.measurements) return {};
    return parseMeasurements(product.measurements);
  });

  // SEO + interní poznámky (live char counters)
  const [metaTitle, setMetaTitle] = useState<string>(product?.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState<string>(
    product?.metaDescription ?? ""
  );
  const [internalNote, setInternalNote] = useState<string>(
    product?.internalNote ?? ""
  );

  // Derived URL array for ImageUpload component
  const imageUrls = structuredImages.map((img) => img.url);

  function handleImageUrlsChange(urls: string[]) {
    // Sync structured images with new URL list (preserve captions for unchanged URLs)
    const captionMap = new Map(structuredImages.map((img) => [img.url, img.alt]));
    setStructuredImages(
      urls.map((url) => ({ url, alt: captionMap.get(url) || "" })),
    );
  }

  function handleCaptionChange(index: number, alt: string) {
    setStructuredImages((prev) =>
      prev.map((img, i) => (i === index ? { ...img, alt } : img)),
    );
  }

  function handleMeasurementChange(key: keyof ProductMeasurements, value: string) {
    const num = parseFloat(value);
    setMeasurements((prev) => ({
      ...prev,
      [key]: isNaN(num) || num <= 0 ? undefined : num,
    }));
  }

  async function formAction(_prev: string | null, formData: FormData) {
    try {
      await action(formData);
      return null;
    } catch (e) {
      if (e instanceof Error && e.message !== "NEXT_REDIRECT") {
        return e.message;
      }
      throw e;
    }
  }

  const [error, dispatch, isPending] = useActionState(formAction, null);

  return (
    <form action={dispatch} className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Images */}
      <div className="space-y-2">
        <Label>Fotky produktu</Label>
        <ImageUpload value={imageUrls} onChange={handleImageUrlsChange} />
        <input type="hidden" name="images" value={JSON.stringify(structuredImages)} />
      </div>

      {/* Image captions — shown when images exist */}
      {structuredImages.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Popisky fotek (pro SEO a přístupnost)</Label>
            {product?.id && (
              <AltTextGenerateButton
                productId={product.id}
                onResult={(images) => setStructuredImages(images)}
              />
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {structuredImages.map((img, i) => (
              <div key={`${img.url}-${i}`} className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground w-12">
                  {i === 0 ? "Hlavní" : `#${i + 1}`}
                </span>
                <Input
                  value={img.alt}
                  onChange={(e) => handleCaptionChange(i, e.target.value)}
                  placeholder={i === 0 ? "např. Šaty zepředu" : "např. Detail látky"}
                  className="text-sm"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Popište co je na fotce — pomáhá vyhledávačům i nevidomým
          </p>
        </div>
      )}

      {/* Product video */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Video className="size-4 text-muted-foreground" />
          Video produktu
        </Label>
        <input type="hidden" name="videoUrl" value={videoUrl} />
        {videoUrl ? (
          <div className="relative max-w-sm">
            <video
              src={videoUrl}
              controls
              preload="metadata"
              className="w-full max-h-[300px] rounded-lg border"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 size-7"
              onClick={() => setVideoUrl("")}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <label
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-6 transition-colors duration-150 ${
                isVideoUploading
                  ? "cursor-default border-primary/30 bg-muted/30"
                  : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="hidden"
                disabled={isVideoUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setIsVideoUploading(true);
                  setVideoUploadError(null);
                  try {
                    const [url] = await uploadFiles([file]);
                    setVideoUrl(url);
                  } catch (err) {
                    setVideoUploadError(
                      err instanceof Error ? err.message : "Nahrávání selhalo"
                    );
                  } finally {
                    setIsVideoUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              {isVideoUploading ? (
                <>
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  <span className="text-sm font-medium">Nahrávám video...</span>
                </>
              ) : (
                <>
                  <Video className="size-8 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Klikněte pro výběr videa
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Max 32 MB, MP4/WebM, 15–30 sekund
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Krátké video produktu (přední, zadní, pohyb)
                  </span>
                </>
              )}
            </label>
            {videoUploadError && (
              <p className="text-sm text-destructive">{videoUploadError}</p>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Nepovinné — krátké video zvyšuje konverzi o 65 %. Ideálně 9:16 na výšku, 15–30 s.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Name */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Název produktu</Label>
          <Input
            id="name"
            name="name"
            defaultValue={product?.name}
            required
            placeholder="např. Letní šaty Adéla"
          />
        </div>

        {/* Description */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Popis</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={product?.description}
            required
            rows={3}
            placeholder="Stručný popis produktu, stav, materiál..."
          />
        </div>

        {/* Fit note */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="fitNote">Poznámka ke střihu</Label>
          <Input
            id="fitNote"
            name="fitNote"
            defaultValue={product?.fitNote ?? ""}
            maxLength={120}
            placeholder="např. Padne rovným postavám, mírně volný v bocích"
          />
          <p className="text-xs text-muted-foreground">
            Krátký popis střihu — jak kousek sedí (max 120 znaků)
          </p>
        </div>

        {/* Price */}
        <div className="space-y-2">
          <Label htmlFor="price">Cena (Kč)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step={1}
            defaultValue={product?.price}
            required
            placeholder="490"
          />
        </div>

        {/* Original price */}
        <div className="space-y-2">
          <Label htmlFor="compareAt">Původní cena (Kč)</Label>
          <Input
            id="compareAt"
            name="compareAt"
            type="number"
            min={0}
            step={1}
            defaultValue={product?.compareAt ?? ""}
            placeholder="1290"
          />
          <p className="text-xs text-muted-foreground">
            Retail cena pro zobrazení slevy
          </p>
        </div>

        {/* SKU */}
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            name="sku"
            defaultValue={product?.sku}
            required
            placeholder="SAT-001"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="categoryId">Kategorie</Label>
          <input type="hidden" name="categoryId" value={categoryId} />
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
            <SelectTrigger id="categoryId" className="h-10 w-full">
              <SelectValue placeholder="Vyberte kategorii" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Brand */}
        <div className="space-y-2">
          <Label htmlFor="brand">Značka</Label>
          <Input
            id="brand"
            name="brand"
            defaultValue={product?.brand ?? ""}
            placeholder="Zara, H&M, Mango..."
          />
        </div>

        {/* Condition */}
        <div className="space-y-2">
          <Label htmlFor="condition">Stav zboží</Label>
          <input type="hidden" name="condition" value={condition} />
          <Select value={condition} onValueChange={(v) => setCondition(v ?? "")}>
            <SelectTrigger id="condition" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sizes — category-aware chip grid (no free text) */}
        <div className="space-y-2 sm:col-span-2">
          <Label>Velikost</Label>
          <input
            type="hidden"
            name="sizes"
            value={selectedSizes.filter((s) => allowedSizesSet.has(s)).join(", ")}
          />
          {!categoryId ? (
            <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Nejprve vyberte kategorii
            </p>
          ) : (
            <div className="space-y-3">
              {sizeGroups.map((group) => (
                <div key={group.key} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.sizes.map((size) => {
                      const selected = selectedSizes.includes(size);
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => toggleSize(size)}
                          className={`min-h-9 min-w-11 rounded-md border px-2.5 py-1 text-sm font-medium transition-colors duration-150 ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground hover:border-primary/50"
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {selectedSizes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Vybráno: {selectedSizes.filter((s) => allowedSizesSet.has(s)).join(", ") || "—"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Colors */}
        <div className="space-y-2">
          <Label htmlFor="colors">Barva</Label>
          <Input
            id="colors"
            name="colors"
            defaultValue={product?.colors}
            required
            placeholder="Černá"
          />
          <p className="text-xs text-muted-foreground">
            Oddělte čárkou, např. Černá, Bílá
          </p>
        </div>
      </div>

      {/* Measurements */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Ruler className="size-4 text-muted-foreground" />
          <Label>Rozměry (cm)</Label>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {([
            ["chest", "Prsa"],
            ["waist", "Pas"],
            ["hips", "Boky"],
            ["length", "Délka"],
            ["sleeve", "Rukáv"],
            ["inseam", "Vnitř. nohavice"],
          ] as const).map(([key, label]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`measurements_${key}`} className="text-xs text-muted-foreground">
                {label}
              </Label>
              <Input
                id={`measurements_${key}`}
                name={`measurements_${key}`}
                type="number"
                min={0}
                step={0.5}
                value={measurements[key] ?? ""}
                onChange={(e) => handleMeasurementChange(key, e.target.value)}
                placeholder="cm"
                className="text-sm"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Nepovinné — reálné rozměry kusu pomohou zákaznicím s výběrem velikosti
        </p>
      </div>

      {/* Defects */}
      <DefectsEditor
        initialNote={product?.defectsNote ?? ""}
        initialImages={parseDefectImages(product?.defectImages)}
      />

      {/* SEO + interní poznámky — collapsible */}
      <details className="rounded-xl border bg-muted/20">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/40 rounded-xl transition-colors duration-150">
          <Search className="size-4 text-muted-foreground" />
          SEO a interní poznámky
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            nepovinné
          </span>
        </summary>
        <div className="space-y-4 border-t border-border/60 p-4">
          {/* Meta title */}
          <div className="space-y-1.5">
            <Label htmlFor="metaTitle">SEO název (title)</Label>
            <Input
              id="metaTitle"
              name="metaTitle"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value.slice(0, 70))}
              maxLength={70}
              placeholder="Pokud nevyplníš, použije se název produktu"
            />
            <p className={`text-xs ${metaTitle.length > 60 ? "text-amber-600" : "text-muted-foreground"}`}>
              {metaTitle.length} / 70 znaků
            </p>
          </div>

          {/* Meta description */}
          <div className="space-y-1.5">
            <Label htmlFor="metaDescription">SEO popis (meta description)</Label>
            <Textarea
              id="metaDescription"
              name="metaDescription"
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value.slice(0, 160))}
              maxLength={160}
              rows={2}
              placeholder="Text pod titulkem ve vyhledávačích. Pokud nevyplníš, použije se popis produktu."
            />
            <p className={`text-xs ${metaDescription.length > 150 ? "text-amber-600" : "text-muted-foreground"}`}>
              {metaDescription.length} / 160 znaků
            </p>
          </div>

          {/* Internal note */}
          <div className="space-y-1.5">
            <Label htmlFor="internalNote">Interní poznámka (neveřejná)</Label>
            <Textarea
              id="internalNote"
              name="internalNote"
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value.slice(0, 2000))}
              maxLength={2000}
              rows={3}
              placeholder="Poznámka jen pro tebe — zákaznice ji neuvidí (např. kde je kousek uložený, proč je v úpravě)"
            />
            <p className="text-xs text-muted-foreground">
              {internalNote.length} / 2000 znaků · zobrazuje se jen v adminu
            </p>
          </div>
        </div>
      </details>

      {/* Toggles */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product?.featured ?? false}
            className="size-4 rounded border-input accent-primary"
          />
          Doporučený produkt
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={product?.active ?? true}
            value="on"
            className="size-4 rounded border-input accent-primary"
          />
          Aktivní (viditelný v obchodě)
        </label>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          <Save className="size-4" />
          {isPending
            ? "Ukládám..."
            : product
              ? "Uložit změny"
              : "Vytvořit produkt"}
        </Button>
      </div>
    </form>
  );
}

interface AltTextGenerateButtonProps {
  productId: string;
  onResult: (images: ProductImage[]) => void;
}

function AltTextGenerateButton({ productId, onResult }: AltTextGenerateButtonProps) {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleClick(force: boolean) {
    setPending(true);
    setMsg(null);
    try {
      const res = await generateProductAltText(productId, { force });
      if (!res.ok) {
        setMsg(
          res.reason === "missing_gemini_key"
            ? "Chybí GEMINI_API_KEY v env"
            : "Generování selhalo",
        );
      } else {
        if (res.images) onResult(res.images);
        setMsg(
          `Vygenerováno ${res.generated} | přeskočeno ${res.skipped}` +
            (res.failed > 0 ? ` | selhalo ${res.failed}` : ""),
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Chyba");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => handleClick(false)}
        title="Doplní AI alt-text jen u fotek bez popisku"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        AI alt-text
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => handleClick(true)}
        title="Přepíše všechny popisky znovu"
      >
        Přegenerovat
      </Button>
    </div>
  );
}
