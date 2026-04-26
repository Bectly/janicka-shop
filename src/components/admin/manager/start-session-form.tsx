"use client";

import { useState, useTransition, useRef } from "react";
import { Sparkles, AlertCircle, Loader2, ImagePlus, X } from "lucide-react";
import {
  requestSessionAction,
  uploadManagerAttachmentAction,
} from "@/app/(admin)/admin/manager/actions";

export function StartSessionForm({
  disabled = false,
  disabledReason,
}: {
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [opening, setOpening] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (attachments.length + files.length > 5) {
      setError("Max 5 obrázků na zprávu");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const r = await uploadManagerAttachmentAction(fd);
        if (!r.ok || !r.url) {
          setError(r.error ?? "Upload selhal");
          break;
        }
        setAttachments((prev) => [...prev, r.url!]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((u) => u !== url));
  };

  const handleSubmit = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const r = await requestSessionAction(opening || undefined, attachments);
      if (!r.ok) {
        setError(r.error ?? "Něco se nepovedlo");
      } else {
        setOpening("");
        setAttachments([]);
        setSuccess(
          "✅ Session requested. Manažerka se rozjede do ~30s, výstupy se objeví níže.",
        );
      }
    });
  };

  return (
    <div className="space-y-3">
      <textarea
        rows={3}
        value={opening}
        onChange={(e) => setOpening(e.target.value.slice(0, 1000))}
        placeholder="Volitelně: napiš co manažerka má řešit (např. 'Podívej se na newslettery, navrhni co dál'). Nech prázdné pro general orientation."
        disabled={isPending || disabled}
        className="w-full resize-none rounded-md border bg-background p-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      />
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((url) => (
            <div key={url} className="relative">
              <img
                src={url}
                alt="attachment"
                className="h-20 w-20 rounded-md border object-cover"
              />
              <button
                type="button"
                onClick={() => removeAttachment(url)}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-red-600 p-0.5 text-white shadow"
                aria-label="Odebrat"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {opening.length}/1000 znaků
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            disabled={uploading || isPending || disabled || attachments.length >= 5}
            className="hidden"
            id="manager-attach-input"
          />
          <label
            htmlFor="manager-attach-input"
            className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent ${
              uploading || attachments.length >= 5
                ? "cursor-not-allowed opacity-50"
                : ""
            }`}
            title="Přidat screenshoty (PNG/JPG/WEBP, max 5 MB každý)"
          >
            {uploading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ImagePlus className="size-3" />
            )}
            {uploading
              ? "Nahrávám…"
              : `Screenshot ${attachments.length}/5`}
          </label>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || disabled || uploading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          title={disabled ? disabledReason : undefined}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Requesting…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Spustit manažerku
            </>
          )}
        </button>
      </div>
      {disabled && disabledReason && (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-2 text-xs text-red-700">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-700">
          {success}
        </div>
      )}
    </div>
  );
}
