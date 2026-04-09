"use client";

import { useState } from "react";
import { Gift, Copy, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackReferralShare } from "@/lib/analytics";

interface ReferralCardProps {
  orderNumber: string;
}

export function ReferralCard({ orderNumber }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const referralUrl = `${baseUrl}/products?ref=${encodeURIComponent(orderNumber)}&utm_source=referral&utm_medium=share&utm_campaign=order-referral`;

  const shareText =
    "Mám pro tebe slevu 100 Kč na Janičku — second hand oblečení v skvělém stavu! Nakup tady:";

  function handleCopy() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      trackShare("copy");
    }).catch(() => {
      // Fallback for insecure contexts or permission denied
      const input = document.createElement("input");
      input.value = referralUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      trackShare("copy");
    });
  }

  function handleWhatsApp() {
    trackShare("whatsapp");
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${shareText} ${referralUrl}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function trackShare(method: string) {
    trackReferralShare(method, orderNumber);
  }

  return (
    <div className="mt-6 rounded-xl border bg-card p-6 text-left shadow-sm">
      <div className="flex items-start gap-3">
        <Gift className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="flex-1">
          <h3 className="font-heading text-base font-semibold text-foreground">
            Pošli kamarádce 100 Kč slevu
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ty dostaneš 150 Kč kredit na další nákup. Ona ušetří 100 Kč na
            první objednávku (od 400 Kč).
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleCopy}>
              {copied ? (
                <Check className="size-4 text-emerald-600" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Zkopírováno!" : "Kopírovat odkaz"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleWhatsApp}>
              <MessageCircle className="size-4" />
              WhatsApp
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
