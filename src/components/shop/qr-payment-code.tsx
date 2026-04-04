import Image from "next/image";
import { Landmark } from "lucide-react";

interface QrPaymentCodeProps {
  /** Base64 data URL of the QR code image */
  qrDataUrl: string;
  /** SPAYD string (displayed as fallback text for copy) */
  spaydString: string;
  /** Order total in CZK (for display) */
  totalCzk: number;
  /** Variable symbol (for display) */
  variableSymbol: string;
}

export function QrPaymentCode({
  qrDataUrl,
  totalCzk,
  variableSymbol,
}: QrPaymentCodeProps) {
  const iban = process.env.SHOP_IBAN ?? "";
  // Format IBAN for display: CZ## #### #### #### #### ####
  const formattedIban = iban.replace(/(.{4})/g, "$1 ").trim();

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <Landmark className="size-5 text-primary" />
        <h3 className="font-heading text-lg font-semibold text-foreground">
          QR platba bankovním převodem
        </h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Naskenujte QR kód svou bankovní aplikací — platební údaje se vyplní
        automaticky.
      </p>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* QR Code */}
        <div className="shrink-0 rounded-lg border bg-white p-2">
          <Image
            src={qrDataUrl}
            alt="QR kód pro bankovní převod"
            width={200}
            height={200}
            unoptimized
          />
        </div>

        {/* Payment details */}
        <div className="w-full space-y-2 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Číslo účtu (IBAN)</span>
            <span className="font-mono text-xs font-medium">
              {formattedIban}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Částka</span>
            <span className="font-medium">
              {new Intl.NumberFormat("cs-CZ", {
                style: "currency",
                currency: "CZK",
                maximumFractionDigits: 0,
              }).format(totalCzk)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Variabilní symbol</span>
            <span className="font-mono font-medium">{variableSymbol}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Měna</span>
            <span className="font-medium">CZK</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Po připsání platby na účet vám pošleme potvrzení emailem. Zpracování
        převodu obvykle trvá 1–2 pracovní dny.
      </p>
    </div>
  );
}
