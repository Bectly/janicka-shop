"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONDITION_LABELS, COLOR_MAP } from "@/lib/constants";
import { ImageUpload } from "@/components/admin/image-upload";
import { uploadFiles } from "@/lib/uploadthing";
import { Zap, ChevronDown, ChevronUp, Video, X, Loader2 } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface QuickAddFormProps {
  categories: Category[];
  action: (formData: FormData) => Promise<void>;
}

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "34", "36", "38", "40", "42", "44", "46"];
const COMMON_COLORS = Object.keys(COLOR_MAP);

export function QuickAddForm({ categories, action }: QuickAddFormProps) {
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [showExtras, setShowExtras] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

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

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const toggleColor = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  return (
    <form action={dispatch} className="space-y-5">
      {error && (
        <div role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Hidden fields */}
      <input type="hidden" name="images" value={JSON.stringify(imageUrls)} />
      <input type="hidden" name="sizes" value={selectedSizes.join(", ")} />
      <input type="hidden" name="colors" value={selectedColors.join(", ")} />
      <input type="hidden" name="videoUrl" value={videoUrl} />

      {/* 1. Photos — biggest, most prominent */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Fotky</Label>
        <ImageUpload value={imageUrls} onChange={setImageUrls} />
      </div>

      {/* 2. Name */}
      <div className="space-y-2">
        <Label htmlFor="qa-name">Název</Label>
        <Input
          id="qa-name"
          name="name"
          required
          placeholder="např. Letní šaty Zara"
          autoComplete="off"
          className="text-base"
        />
      </div>

      {/* 3. Price + Original price side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="qa-price">Cena (Kč)</Label>
          <Input
            id="qa-price"
            name="price"
            type="number"
            min={0}
            step={1}
            required
            placeholder="490"
            inputMode="numeric"
            className="text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qa-compareAt">Původní cena</Label>
          <Input
            id="qa-compareAt"
            name="compareAt"
            type="number"
            min={0}
            step={1}
            placeholder="1 290"
            inputMode="numeric"
            className="text-base"
          />
        </div>
      </div>

      {/* 4. Category */}
      <div className="space-y-2">
        <Label htmlFor="qa-category">Kategorie</Label>
        <select
          id="qa-category"
          name="categoryId"
          required
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Vyberte</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* 5. Size — tap-to-select chips */}
      <div className="space-y-2">
        <Label>Velikost</Label>
        <div className="flex flex-wrap gap-2">
          {COMMON_SIZES.map((size) => {
            const selected = selectedSizes.includes(size);
            return (
              <button
                key={size}
                type="button"
                onClick={() => toggleSize(size)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
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
        {selectedSizes.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Vybráno: {selectedSizes.join(", ")}
          </p>
        )}
      </div>

      {/* 6. Condition */}
      <div className="space-y-2">
        <Label htmlFor="qa-condition">Stav</Label>
        <select
          id="qa-condition"
          name="condition"
          defaultValue="excellent"
          required
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Object.entries(CONDITION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* 7. Color — tap-to-select with color swatches */}
      <div className="space-y-2">
        <Label>Barva</Label>
        <div className="flex flex-wrap gap-2">
          {COMMON_COLORS.map((color) => {
            const hex = COLOR_MAP[color as keyof typeof COLOR_MAP];
            const selected = selectedColors.includes(color);
            return (
              <button
                key={color}
                type="button"
                onClick={() => toggleColor(color)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                }`}
              >
                <span
                  className="inline-block size-3 rounded-full border border-black/10"
                  style={{ backgroundColor: hex }}
                />
                {color}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expandable extras section */}
      <button
        type="button"
        onClick={() => setShowExtras(!showExtras)}
        className="flex w-full items-center justify-between rounded-lg border border-dashed border-muted-foreground/30 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
      >
        <span>Další údaje (značka, popis)</span>
        {showExtras ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {showExtras && (
        <div className="space-y-4 rounded-lg border border-dashed border-muted-foreground/20 p-4">
          <div className="space-y-2">
            <Label htmlFor="qa-brand">Značka</Label>
            <Input
              id="qa-brand"
              name="brand"
              placeholder="Zara, H&M, Mango..."
              className="text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qa-description">Popis</Label>
            <Textarea
              id="qa-description"
              name="description"
              rows={3}
              placeholder="Volitelný — vygeneruje se automaticky z názvu a stavu"
              className="text-base"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Video className="size-4 text-muted-foreground" />
              Video
            </Label>
            {videoUrl ? (
              <div className="relative max-w-sm">
                <video
                  src={videoUrl}
                  controls
                  preload="metadata"
                  className="w-full rounded-lg border"
                  style={{ maxHeight: "200px" }}
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
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-4 transition-colors ${
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
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  ) : (
                    <Video className="size-6 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {isVideoUploading ? "Nahrávám..." : "Klikněte pro výběr videa"}
                  </span>
                </label>
                {videoUploadError && (
                  <p className="text-xs text-destructive">{videoUploadError}</p>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">Nepovinné — 9:16, 15–30 s</p>
          </div>
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full text-base"
        disabled={isPending}
      >
        <Zap className="size-4" />
        {isPending ? "Přidávám..." : "Přidat kousek"}
      </Button>
    </form>
  );
}
