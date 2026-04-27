"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Smartphone, Check, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface BatchStart {
  batchId: string;
  qrUrl: string;
  expiresAt: string;
}

interface BatchStatus {
  status: "open" | "sealed" | "published" | "expired";
  draftCount: number;
}

const POLL_INTERVAL_MS = 5_000;

export function QrBatchModal() {
  const [open, setOpen] = useState(false);
  const [batch, setBatch] = useState<BatchStart | null>(null);
  const [status, setStatus] = useState<BatchStatus>({
    status: "open",
    draftCount: 0,
  });
  const [now, setNow] = useState(() => Date.now());
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const startedRef = useRef(false);

  const startBatch = useCallback(async () => {
    setIsStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/admin/drafts/start", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Nepodařilo se vytvořit batch.");
      }
      const data = (await res.json()) as BatchStart;
      setBatch(data);
      setStatus({ status: "open", draftCount: 0 });
    } catch (err) {
      setStartError(
        err instanceof Error ? err.message : "Nepodařilo se vytvořit batch."
      );
    } finally {
      setIsStarting(false);
    }
  }, []);

  // Start a new batch when modal opens (once)
  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      void startBatch();
    }
    if (!open) {
      startedRef.current = false;
      setBatch(null);
      setStatus({ status: "open", draftCount: 0 });
      setStartError(null);
    }
  }, [open, startBatch]);

  // Tick clock every second for countdown
  useEffect(() => {
    if (!open || !batch) return;
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [open, batch]);

  // Poll batch status every 5s
  useEffect(() => {
    if (!open || !batch) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/admin/drafts/${batch!.batchId}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as Partial<BatchStatus>;
        if (cancelled) return;
        if (data.status && typeof data.draftCount === "number") {
          setStatus({
            status: data.status,
            draftCount: data.draftCount,
          });
        }
      } catch {
        // Silent retry on next interval
      }
    }

    void poll();
    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, batch]);

  const expiresAt = batch ? new Date(batch.expiresAt).getTime() : 0;
  const remainingMs = Math.max(0, expiresAt - now);
  const totalMs = 15 * 60 * 1000;
  const elapsedRatio = batch ? Math.min(1, 1 - remainingMs / totalMs) : 0;
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1_000);
  const countdownLabel = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const expired = batch !== null && remainingMs <= 0;

  const isSealed = status.status === "sealed" || status.status === "published";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Smartphone className="size-4" />
            <span className="hidden sm:inline">Přidat z mobilu</span>
            <span className="sm:hidden">Mobil</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="size-4" aria-hidden />
            Přidat kousky z mobilu
          </DialogTitle>
          <DialogDescription>
            Naskenuj QR kód telefonem Janičky — otevře se mobilní formulář pro
            rychlé přidávání. Odkaz platí 15 minut.
          </DialogDescription>
        </DialogHeader>

        {isStarting && (
          <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin" aria-hidden />
            Připravuji QR kód…
          </div>
        )}

        {startError && (
          <div className="space-y-3 py-4 text-center">
            <p role="alert" className="text-sm text-destructive">
              {startError}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void startBatch()}
            >
              Zkusit znovu
            </Button>
          </div>
        )}

        {batch && !isSealed && !expired && (
          <div className="space-y-4">
            <div className="flex justify-center rounded-xl bg-white p-4 ring-1 ring-foreground/10">
              <QRCodeSVG
                value={batch.qrUrl}
                size={208}
                level="M"
                marginSize={2}
                aria-label="QR kód pro mobilní přidávání"
              />
            </div>

            <div className="space-y-2" aria-live="polite">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Vyprší za</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {countdownLabel}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-1000 ease-linear"
                  style={{ width: `${(1 - elapsedRatio) * 100}%` }}
                  aria-hidden
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-xs text-muted-foreground">Přidáno draftů</p>
                <p className="font-heading text-2xl font-bold tabular-nums text-foreground">
                  {status.draftCount}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={status.draftCount === 0}
                render={
                  <Link
                    href={`/admin/drafts/${batch.batchId}`}
                    onClick={() => setOpen(false)}
                  />
                }
              >
                Otevřít batch
                <ExternalLink className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        )}

        {batch && expired && !isSealed && (
          <div className="space-y-3 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              QR kód vypršel. Vytvoř nový.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void startBatch()}
            >
              Nový QR kód
            </Button>
          </div>
        )}

        {batch && isSealed && (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Check className="size-6 text-primary" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="font-heading text-lg font-semibold text-foreground">
                Hotovo!
              </p>
              <p className="text-sm text-muted-foreground">
                Janička přidala{" "}
                <strong className="text-foreground">
                  {status.draftCount}
                </strong>{" "}
                {status.draftCount === 1
                  ? "kousek"
                  : status.draftCount < 5
                    ? "kousky"
                    : "kousků"}
                .
              </p>
            </div>
            <Button
              type="button"
              className="w-full"
              render={
                <Link
                  href={`/admin/drafts/${batch.batchId}`}
                  onClick={() => setOpen(false)}
                />
              }
            >
              Otevřít batch k revizi
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <DialogClose
            render={
              <Button variant="ghost" size="sm">
                Zavřít
              </Button>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
