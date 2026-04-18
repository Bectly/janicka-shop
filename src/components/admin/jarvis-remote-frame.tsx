"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "ready"; url: string; expiresAt: string }
  | { kind: "error"; message: string };

async function uploadBlob(file: File): Promise<{ url: string; expires_at: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/claude-upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Upload selhal (${res.status})`);
  }
  return (await res.json()) as { url: string; expires_at: string };
}

export function JarvisRemoteFrame() {
  const [state, setState] = useState<UploadState>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setState({ kind: "uploading" });
    try {
      const { url, expires_at } = await uploadBlob(file);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Clipboard may be blocked — still expose URL below.
      }
      setState({ kind: "ready", url, expiresAt: expires_at });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Upload selhal",
      });
    }
  }, []);

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void handleFile(file);
            return;
          }
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] flex-col gap-4">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Přihlášení do terminálu</p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
          <li>
            Přijde 6-místný kód z Cloudflare na tvůj email — zadej ho
          </li>
          <li>
            Pak ttyd basic auth — username:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">jarvis</code>, heslo ti pošlu zvlášť
          </li>
          <li>Otevře se Claude Code terminal s přístupem k eshopu</li>
        </ol>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={state.kind === "uploading"}
          className="inline-flex items-center rounded-md border bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent disabled:opacity-50"
        >
          {state.kind === "uploading" ? "Nahrávám…" : "Upload screenshot"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <span className="text-muted-foreground">
          nebo stiskni <kbd className="rounded border bg-background px-1">Ctrl</kbd>+<kbd className="rounded border bg-background px-1">V</kbd> pro paste obrázku
        </span>
      </div>

      {state.kind === "ready" && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm">
          <p className="font-medium text-green-700 dark:text-green-300">
            ✓ Screenshot nahrán — URL zkopírovaná do schránky.
          </p>
          <p className="mt-1 text-muted-foreground">
            Pastni <kbd className="rounded border bg-background px-1">Ctrl</kbd>+<kbd className="rounded border bg-background px-1">V</kbd> do terminálu. Platnost 1 hodina.
          </p>
          <code className="mt-2 block truncate rounded bg-muted px-2 py-1 text-xs">
            {state.url}
          </code>
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">Upload selhal</p>
          <p className="mt-1 text-muted-foreground">{state.message}</p>
        </div>
      )}

      <iframe
        src="https://jarvis-janicka.jvsatnik.cz"
        title="JARVIS Remote Console"
        className="w-full flex-1 rounded-lg border bg-black"
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
        allow=""
      />
    </div>
  );
}
