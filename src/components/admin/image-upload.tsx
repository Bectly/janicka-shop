"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { uploadFiles } from "@/lib/upload-client";
import {
  X,
  GripVertical,
  ImagePlus,
  Loader2,
  Camera,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
}

const LONG_PRESS_MS = 450;
const TOUCH_MOVE_TOLERANCE_PX = 8;

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reorderIndex, setReorderIndex] = useState<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Exit reorder mode if image set changes (add/remove) or component unmounts.
  useEffect(() => {
    if (reorderIndex !== null && reorderIndex >= value.length) {
      setReorderIndex(null);
    }
  }, [value.length, reorderIndex]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const removeImage = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
      setReorderIndex(null);
    },
    [value, onChange]
  );

  const swapImages = useCallback(
    (i: number, j: number) => {
      if (i === j) return;
      const updated = [...value];
      [updated[i], updated[j]] = [updated[j], updated[i]];
      onChange(updated);
    },
    [value, onChange]
  );

  // ---- Desktop HTML5 drag-and-drop (preserved) ----
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const updated = [...value];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    onChange(updated);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ---- Mobile long-press → tap-to-swap ----
  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStart = (
    e: React.TouchEvent<HTMLDivElement>,
    index: number
  ) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    longPressFiredRef.current = false;
    cancelLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setReorderIndex(index);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate(15);
        } catch {
          /* ignore */
        }
      }
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    const start = touchStartRef.current;
    if (!touch || !start) return;
    const dx = Math.abs(touch.clientX - start.x);
    const dy = Math.abs(touch.clientY - start.y);
    if (dx > TOUCH_MOVE_TOLERANCE_PX || dy > TOUCH_MOVE_TOLERANCE_PX) {
      cancelLongPress();
    }
  };

  const handleTouchEnd = () => {
    cancelLongPress();
    touchStartRef.current = null;
  };

  const handleTileClick = (index: number) => {
    // If long-press just fired, suppress the synthetic click that follows touchend.
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (reorderIndex === null) return;
    if (reorderIndex === index) {
      setReorderIndex(null);
      return;
    }
    swapImages(reorderIndex, index);
    setReorderIndex(null);
  };

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;

    const remaining = 10 - value.length;
    if (remaining <= 0) return;

    const filesToUpload = Array.from(files).slice(0, remaining);
    setIsUploading(true);
    setUploadError(null);

    try {
      const urls = await uploadFiles(filesToUpload);
      onChange([...value, ...urls]);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Nahrávání selhalo"
      );
    } finally {
      setIsUploading(false);
      // Reset file inputs so same files can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  }

  function handleDropzoneFilesDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    handleFilesSelected(e.dataTransfer.files);
  }

  const reorderActive = reorderIndex !== null;

  return (
    <div className="space-y-3">
      {/* Reorder-mode banner (mobile-friendly, also shows on desktop if triggered) */}
      {reorderActive && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground"
        >
          <span className="flex items-center gap-2">
            <ArrowLeftRight className="size-4 text-primary" />
            Klepni na jinou fotku pro výměnu
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setReorderIndex(null)}
          >
            Zrušit
          </Button>
        </div>
      )}

      {/* Image previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {value.map((url, index) => {
            const isSelectedForSwap = reorderIndex === index;
            const isSwapTarget = reorderActive && !isSelectedForSwap;
            return (
              <div
                key={url}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onClick={() => handleTileClick(index)}
                role={reorderActive ? "button" : undefined}
                tabIndex={reorderActive ? 0 : undefined}
                aria-label={
                  isSelectedForSwap
                    ? `Vybráno: pozice ${index + 1}. Klepni jinde pro výměnu nebo znovu pro zrušení.`
                    : isSwapTarget
                      ? `Vyměnit s pozicí ${index + 1}`
                      : `Fotka ${index + 1}. Stiskni a podrž pro přesunutí.`
                }
                onKeyDown={(e) => {
                  if (!reorderActive) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleTileClick(index);
                  } else if (e.key === "Escape") {
                    setReorderIndex(null);
                  }
                }}
                style={{ touchAction: "pan-y", WebkitTouchCallout: "none" }}
                className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition-all select-none ${
                  isSelectedForSwap
                    ? "ring-primary ring-offset-background scale-105 border-primary ring-4 ring-offset-2"
                    : isSwapTarget
                      ? "border-primary/40 cursor-pointer opacity-70 hover:opacity-100"
                      : dragOverIndex === index
                        ? "border-primary scale-105"
                        : dragIndex === index
                          ? "border-dashed border-muted-foreground/50 opacity-50"
                          : "border-transparent"
                }`}
              >
                <Image
                  src={url}
                  alt={`Produkt ${index + 1}`}
                  fill
                  className="pointer-events-none object-cover"
                  draggable={false}
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                />
                {index === 0 && (
                  <span className="absolute top-1.5 left-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    Hlavní
                  </span>
                )}
                {isSwapTarget && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="rounded-full bg-background/90 px-2 py-1 text-xs font-medium text-foreground shadow">
                      Klepni pro výměnu
                    </span>
                  </div>
                )}
                {isSelectedForSwap && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground shadow">
                      Vybráno
                    </span>
                  </div>
                )}
                <div
                  className={`absolute inset-0 flex items-start justify-between p-1.5 transition-opacity ${
                    reorderActive
                      ? "pointer-events-none opacity-0"
                      : "bg-black/0 opacity-0 group-hover:bg-black/20 group-hover:opacity-100"
                  }`}
                >
                  <GripVertical className="size-4 cursor-grab text-white drop-shadow active:cursor-grabbing" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="size-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hint: how to reorder on mobile (only shown when there are 2+ images and not yet in reorder mode) */}
      {value.length >= 2 && !reorderActive && (
        <p className="text-center text-[11px] text-muted-foreground sm:hidden">
          Tip: stiskni a podrž fotku pro přesunutí
        </p>
      )}

      {/* Upload area */}
      {value.length < 10 && (
        <>
          {/* Mobile-first: side-by-side camera + gallery buttons (sm-) */}
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            <Button
              type="button"
              variant="outline"
              className="h-14 flex-col gap-1 text-xs"
              disabled={isUploading}
              onClick={() => !isUploading && cameraInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Camera className="size-5" />
              )}
              <span>Vyfoť</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 flex-col gap-1 text-xs"
              disabled={isUploading}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ImagePlus className="size-5" />
              )}
              <span>Z galerie</span>
            </Button>
            <span className="col-span-2 text-center text-xs text-muted-foreground">
              {value.length}/10 fotek — max 4 MB každá
            </span>
          </div>

          {/* Desktop dropzone (sm+) */}
          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDropzoneFilesDrop}
            className={`hidden cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-6 transition-colors duration-150 sm:flex ${
              isUploading
                ? "cursor-default border-primary/30 bg-muted/30"
                : isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            {isUploading ? (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <span className="text-sm font-medium">Nahrávám...</span>
              </>
            ) : (
              <>
                <ImagePlus className="size-8 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Přetáhněte fotky sem nebo klikněte
                </span>
                <span className="text-xs text-muted-foreground">
                  Max 10 fotek, do 4 MB každá — JPEG, PNG, WebP
                </span>
                <span className="text-xs text-muted-foreground">
                  {value.length}/10 fotek nahráno
                </span>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/avif"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          {uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}
        </>
      )}
    </div>
  );
}
