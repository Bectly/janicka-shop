"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Trash2, Upload } from "lucide-react";
import { uploadFiles } from "@/lib/upload-client";
import { updateHeroEditorialImage } from "./actions";

interface HeroEditorialImageFormProps {
  initialUrl: string | null;
}

export function HeroEditorialImageForm({ initialUrl }: HeroEditorialImageFormProps) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    if (!file) return;
    setStatus(null);
    setUploading(true);
    try {
      const [uploadedUrl] = await uploadFiles([file]);
      if (!uploadedUrl) throw new Error("Nahrávání selhalo");
      startTransition(async () => {
        const result = await updateHeroEditorialImage(uploadedUrl);
        setStatus({ success: result.success, message: result.message });
        if (result.success) setUrl(result.url);
      });
    } catch (err) {
      setStatus({
        success: false,
        message: err instanceof Error ? err.message : "Nahrávání selhalo",
      });
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setStatus(null);
    startTransition(async () => {
      const result = await updateHeroEditorialImage(null);
      setStatus({ success: result.success, message: result.message });
      if (result.success) setUrl(null);
    });
  }

  const busy = uploading || pending;

  return (
    <div className="space-y-4">
      {status && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            status.success
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {status.success ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          {status.message}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative aspect-[4/5] w-full max-w-[200px] overflow-hidden rounded-2xl border border-border/60 bg-muted">
          {url ? (
            <Image
              src={url}
              alt="Náhled editoriálního foto"
              fill
              sizes="200px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Žádné foto
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Doporučeno: portrétní fotka Janičky s oblečením (poměr 4:5, min.
            960×1200&nbsp;px). Když nevyplníte, zobrazí se logo.
          </p>

          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent">
            <Upload className="size-4" aria-hidden="true" />
            {busy ? "Nahrávám…" : "Nahrát foto"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
          </label>

          {url ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={busy}
              onClick={handleRemove}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Odstranit foto
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
