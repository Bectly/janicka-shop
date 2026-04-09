"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { uploadFiles } from "@/lib/uploadthing";
import { X, GripVertical, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removeImage = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange]
  );

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
      // Reset file input so same files can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleDropzoneFilesDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    handleFilesSelected(e.dataTransfer.files);
  }

  return (
    <div className="space-y-3">
      {/* Image previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {value.map((url, index) => (
            <div
              key={url}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                dragOverIndex === index
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
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
              />
              {index === 0 && (
                <span className="absolute top-1.5 left-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Hlavní
                </span>
              )}
              <div className="absolute inset-0 flex items-start justify-between bg-black/0 p-1.5 opacity-0 transition-opacity group-hover:bg-black/20 group-hover:opacity-100">
                <GripVertical className="size-4 cursor-grab text-white drop-shadow active:cursor-grabbing" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="size-6"
                  onClick={() => removeImage(index)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {value.length < 10 && (
        <>
          <div
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDropzoneFilesDrop}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-6 transition-colors ${
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

          {uploadError && (
            <p className="text-sm text-destructive">{uploadError}</p>
          )}
        </>
      )}
    </div>
  );
}
