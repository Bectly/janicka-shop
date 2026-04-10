"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { Landmark, Copy, Check, Smartphone } from "lucide-react";

interface QrPaymentCodeProps {
  /** Base64 data URL of the QR code image */
  qrDataUrl: string;
  /** SPAYD string (displayed as fallback text for copy) */
  spaydString: string;
  /** Order total in CZK (for display) */
  totalCzk: number;
  /** Variable symbol (for display) */
  variableSymbol: string;
  /** IBAN for display (passed from server) */
  iban: string;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label={`Kopírovat ${label}`}
      title={`Kopírovat ${label}`}
    >
      {copied ? (
        <Check className="size-3 text-sage-dark" />
      ) : (
        <Copy className="size-3" />
      )}
    </button>
  );
}

export function QrPaymentCode({
  qrDataUrl,
  totalCzk,
  variableSymbol,
  iban,
}: QrPaymentCodeProps) {
  // Format IBAN for display: CZ## #### #### #### #### ####
  const formattedIban = iban.replace(/(.{4})/g, "$1 ").trim();

  const formattedAmount = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(totalCzk);

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Landmark className="size-5 text-primary" />
        <h3 className="font-heading text-lg font-semibold text-foreground">
          QR platba bankovním převodem
        </h3>
      </div>

      {/* Step-by-step instructions */}
      <ol className="mt-4 space-y-2 text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            1
          </span>
          <span>
            Otevřete svou <strong className="text-foreground">bankovní aplikaci</strong> v telefonu
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            2
          </span>
          <span>
            Zvolte <strong className="text-foreground">platbu QR kódem</strong>{" "}
            <Smartphone className="mb-0.5 inline size-3.5" /> a naskenujte kód níže
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            3
          </span>
          <span>
            Údaje se vyplní automaticky — stačí <strong className="text-foreground">potvrdit platbu</strong>
          </span>
        </li>
      </ol>

      <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        {/* QR Code */}
        <div className="shrink-0 rounded-lg border-2 border-dashed border-primary/20 bg-white p-3">
          <Image
            src={qrDataUrl}
            alt="QR kód pro bankovní převod"
            width={200}
            height={200}
            unoptimized
          />
        </div>

        {/* Payment details */}
        <div className="w-full space-y-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Platební údaje
          </p>
          <div className="space-y-2 rounded-lg bg-muted/50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">IBAN</span>
              <span className="flex items-center gap-1">
                <span className="font-mono text-xs font-medium">
                  {formattedIban}
                </span>
                <CopyButton value={iban} label="IBAN" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Částka</span>
              <span className="font-semibold text-foreground">
                {formattedAmount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Variabilní symbol</span>
              <span className="flex items-center gap-1">
                <span className="font-mono font-medium">{variableSymbol}</span>
                <CopyButton value={variableSymbol} label="variabilní symbol" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Měna</span>
              <span className="font-medium">CZK</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Nemáte QR skener? Opište údaje výše do své internetové banky.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-champagne-light px-3 py-2.5 text-xs text-champagne-dark">
        Po připsání platby vám pošleme potvrzení emailem. Okamžité převody
        dorazí během pár sekund, standardní převody do 1–2 pracovních dnů.
      </div>
    </div>
  );
}
