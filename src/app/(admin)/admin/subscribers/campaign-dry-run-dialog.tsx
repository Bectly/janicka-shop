"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Eye,
  Send,
  Mail,
  X,
} from "lucide-react";

interface Preview {
  subject: string;
  html: string;
  subscriberCount: number;
  sampleEmail: string;
  segmentCounts?: { warm: number; cold: number };
  segmentSubjects?: { warm: string; cold: string };
}

interface TestResult {
  success: boolean;
  recipient?: string;
  error?: string;
}

interface SendResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  accentColor: "primary" | "pink" | "emerald";
  loadPreview: () => Promise<Preview>;
  sendTest: () => Promise<TestResult>;
  sendAll: (confirmation: string) => Promise<SendResult>;
  onSent?: () => void;
}

const CONFIRMATION_WORD = "OSLOVIT";

const ACCENT_CLASSES: Record<
  Props["accentColor"],
  { border: string; bg: string; text: string; button: string; buttonHover: string }
> = {
  primary: {
    border: "border-primary/30",
    bg: "bg-primary/5",
    text: "text-primary",
    button: "bg-primary",
    buttonHover: "hover:bg-primary/90",
  },
  pink: {
    border: "border-pink-300",
    bg: "bg-pink-50/50",
    text: "text-pink-700",
    button: "bg-pink-600",
    buttonHover: "hover:bg-pink-700",
  },
  emerald: {
    border: "border-emerald-300",
    bg: "bg-emerald-50/50",
    text: "text-emerald-700",
    button: "bg-emerald-600",
    buttonHover: "hover:bg-emerald-700",
  },
};

export function CampaignDryRunDialog({
  open,
  onClose,
  title,
  accentColor,
  loadPreview,
  sendTest,
  sendAll,
  onSent,
}: Props) {
  const accent = ACCENT_CLASSES[accentColor];

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState<TestResult | null>(null);

  const [confirmation, setConfirmation] = useState("");
  const [finalSending, setFinalSending] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(
    null,
  );

  // Load preview on open; reset state on close.
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setTestSent(null);
      setConfirmation("");
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    loadPreview()
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            type: "error",
            message: err instanceof Error ? err.message : "Náhled se nepodařilo načíst.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, loadPreview]);

  async function handleSendTest() {
    setTestSending(true);
    try {
      const res = await sendTest();
      setTestSent(res);
    } finally {
      setTestSending(false);
    }
  }

  async function handleSendAll() {
    if (confirmation !== CONFIRMATION_WORD) return;
    setFinalSending(true);
    setResult(null);
    try {
      const res = await sendAll(confirmation);
      if (res.success) {
        setResult({
          type: "success",
          message: `Kampaň odeslána ${res.sentCount} odběratelům${res.failedCount > 0 ? `, ${res.failedCount} selhalo` : ""}.`,
        });
        onSent?.();
      } else {
        setResult({
          type: "error",
          message: res.error ?? "Nepodařilo se odeslat kampaň.",
        });
      }
    } finally {
      setFinalSending(false);
    }
  }

  if (!open) return null;

  const canSendAll =
    !!testSent?.success && confirmation === CONFIRMATION_WORD && result?.type !== "success";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Dry-run režim — zkontroluj všechno, pošli test a pak teprve spusť na všechny.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            aria-label="Zavřít"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-5">
          {/* Preview pane */}
          <div className="flex flex-col border-b md:col-span-3 md:border-b-0 md:border-r">
            <div className={`flex items-center gap-2 border-b px-4 py-2 text-xs font-medium ${accent.text}`}>
              <Eye className="size-4" />
              Náhled e-mailu
            </div>
            {loadingPreview ? (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Načítám náhled…
              </div>
            ) : preview ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Předmět:</span> {preview.subject}
                  </div>
                  <div className="mt-1">
                    <span className="font-medium text-foreground">Ukázkový příjemce:</span>{" "}
                    {preview.sampleEmail}
                  </div>
                </div>
                <iframe
                  title="Email preview"
                  sandbox=""
                  srcDoc={preview.html}
                  className="flex-1 min-h-[320px] w-full border-0 bg-white"
                />
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                Náhled nelze zobrazit.
              </div>
            )}
          </div>

          {/* Steps pane */}
          <div className="flex flex-col gap-4 overflow-y-auto p-5 md:col-span-2">
            {/* Step 1: Count */}
            <div className={`rounded-lg border ${accent.border} ${accent.bg} p-4`}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Krok 1 — Příjemci
              </p>
              <p className="mt-1 text-sm text-foreground">
                Bude odesláno{" "}
                <strong className={accent.text}>
                  {preview?.subscriberCount ?? "?"}
                </strong>{" "}
                aktivním odběratelům.
              </p>
              {preview?.segmentCounts && preview?.segmentSubjects && (
                <div className="mt-3 space-y-2 border-t border-border/50 pt-3 text-xs">
                  <p className="font-semibold text-muted-foreground">
                    A/B rozdělení (do 90 dní = warm, jinak cold):
                  </p>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-emerald-800">
                        Warm ({preview.segmentCounts.warm})
                      </span>
                      <span className="text-[11px] text-emerald-700">Subject A</span>
                    </div>
                    <p className="mt-0.5 truncate text-emerald-900" title={preview.segmentSubjects.warm}>
                      „{preview.segmentSubjects.warm}“
                    </p>
                  </div>
                  <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-amber-800">
                        Cold ({preview.segmentCounts.cold})
                      </span>
                      <span className="text-[11px] text-amber-700">Subject B</span>
                    </div>
                    <p className="mt-0.5 truncate text-amber-900" title={preview.segmentSubjects.cold}>
                      „{preview.segmentSubjects.cold}“
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Test send */}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Krok 2 — Pošli sobě
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pošle jeden reálný e-mail přes Resend na tvoji admin adresu, ať to můžeš otevřít v
                mobilu, Gmailu i Apple Mail.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={testSending || !preview}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {testSending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  {testSent?.success ? "Poslat znovu sobě" : "Poslat test sobě"}
                </button>
                {testSent && (
                  <div
                    className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                      testSent.success
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-red-200 bg-red-50 text-red-700"
                    }`}
                  >
                    {testSent.success ? (
                      <>
                        <CheckCircle className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          Test odeslán na <strong>{testSent.recipient}</strong>. Zkontroluj
                          schránku.
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                        <span>{testSent.error}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Typed confirmation */}
            <div
              className={`rounded-lg border p-4 ${
                testSent?.success
                  ? "border-border bg-card"
                  : "border-border bg-muted/30 opacity-60"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Krok 3 — Potvrzení
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Napiš přesně <strong className="text-foreground">{CONFIRMATION_WORD}</strong>{" "}
                pro potvrzení odeslání všem.
              </p>
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value.toUpperCase())}
                disabled={!testSent?.success || finalSending}
                placeholder={CONFIRMATION_WORD}
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono tracking-widest text-foreground focus:border-foreground focus:outline-none disabled:opacity-50"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* Final result */}
            {result && (
              <div
                className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                  result.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {result.type === "success" ? (
                  <CheckCircle className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                )}
                <span className="flex-1">{result.message}</span>
                {result.type === "error" && (
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="shrink-0 text-xs underline underline-offset-2 opacity-70 hover:opacity-100"
                  >
                    Zkusit znovu
                  </button>
                )}
              </div>
            )}

            {/* Step 4: Send */}
            <div className="mt-auto flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSendAll}
                disabled={!canSendAll || finalSending}
                className={`inline-flex items-center justify-center gap-2 rounded-lg ${accent.button} ${accent.buttonHover} px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-40`}
              >
                {finalSending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Odesílám všem…
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    Odeslat všem ({preview?.subscriberCount ?? 0})
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={finalSending}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {result?.type === "success" ? "Zavřít" : "Zrušit"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
