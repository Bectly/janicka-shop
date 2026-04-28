"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Keyboard } from "lucide-react";

type DetectorState = "idle" | "supported" | "unsupported" | "denied" | "running" | "error";

type Barcode = {
  rawValue: string;
};

type BarcodeDetectorCtor = new (opts: { formats: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Barcode[]>;
};

function getDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

function extractProductId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Accept full URLs like https://.../admin/products/<id> or /admin/products/<id>
  const m = trimmed.match(/\/admin\/products\/([a-z0-9_-]{8,})/i);
  if (m) return m[1];
  // Accept raw cuid-ish IDs (8+ chars alnum)
  if (/^[a-z0-9_-]{8,}$/i.test(trimmed)) return trimmed;
  return null;
}

export function QrScannerClient() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [state, setState] = useState<DetectorState>("supported");
  const [error, setError] = useState<string | null>(null);
  const [manualId, setManualId] = useState("");
  const [lastDecoded, setLastDecoded] = useState<string | null>(null);

  function stopStream() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const s = streamRef.current;
    if (s) {
      for (const track of s.getTracks()) track.stop();
      streamRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  async function handleStart() {
    setError(null);
    const Ctor = getDetectorCtor();
    if (!Ctor) {
      setState("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setState("running");

      const detector = new Ctor({ formats: ["qr_code"] });
      const tick = async () => {
        if (!videoRef.current || streamRef.current === null) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const raw = codes[0].rawValue;
            setLastDecoded(raw);
            const productId = extractProductId(raw);
            if (productId) {
              stopStream();
              router.push(`/admin/products/${productId}/edit`);
              return;
            }
          }
        } catch {
          /* transient detector error — keep scanning */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/Permission|NotAllowed|Denied/i.test(msg)) {
        setState("denied");
        setError("Přístup ke kameře byl zamítnut. Použij zadání ID ručně.");
      } else {
        setState("error");
        setError(msg);
      }
    }
  }

  function handleManual(e: React.FormEvent) {
    e.preventDefault();
    const productId = extractProductId(manualId);
    if (!productId) {
      setError("Neplatné ID. Vlož ID produktu nebo URL štítku.");
      return;
    }
    router.push(`/admin/products/${productId}/edit`);
  }

  return (
    <div className="space-y-4">
      {state === "unsupported" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-200">
          Tento prohlížeč nepodporuje skenování přes BarcodeDetector. Zadej ID
          ručně níže (Chrome na Androidu funguje).
        </div>
      )}

      {state !== "unsupported" && (
        <div className="overflow-hidden rounded-2xl border bg-black">
          <div className="relative aspect-[3/4] w-full bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {state !== "running" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center text-white">
                <Camera className="size-10 opacity-80" />
                <p className="text-sm">
                  Klikni na <strong>Spustit kameru</strong> a namiř QR štítek.
                </p>
                <button
                  type="button"
                  onClick={handleStart}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground active:scale-95"
                >
                  <Camera className="size-4" />
                  Spustit kameru
                </button>
              </div>
            )}
            {state === "running" && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div className="h-3/5 w-4/5 rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
            )}
          </div>
          {state === "running" && (
            <button
              type="button"
              onClick={() => {
                stopStream();
                setState("supported");
              }}
              className="flex w-full items-center justify-center gap-2 bg-black/80 px-4 py-3 text-sm font-medium text-white"
            >
              <CameraOff className="size-4" />
              Zastavit kameru
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {lastDecoded && state === "running" && (
        <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>Naposledy rozpoznáno (neplatné pro produkt):</p>
          <p className="mt-1 break-all font-mono">{lastDecoded}</p>
        </div>
      )}

      <form
        onSubmit={handleManual}
        className="rounded-2xl border bg-card p-4 shadow-sm"
      >
        <label
          htmlFor="manualId"
          className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground"
        >
          <Keyboard className="size-4" />
          Zadat ID ručně
        </label>
        <div className="flex gap-2">
          <input
            id="manualId"
            type="text"
            inputMode="text"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="ID produktu nebo URL štítku"
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground active:scale-95"
          >
            Otevřít
          </button>
        </div>
      </form>
    </div>
  );
}
