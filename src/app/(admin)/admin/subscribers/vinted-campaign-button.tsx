"use client";

import { useCallback, useState } from "react";
import { ShieldAlert } from "lucide-react";
import {
  sendVintedTcCampaign,
  previewVintedCampaign,
  sendVintedTestEmail,
} from "./actions";
import { CampaignDryRunDialog } from "./campaign-dry-run-dialog";

interface Props {
  activeSubscriberCount: number;
  onSent?: () => void;
}

export function VintedCampaignButton({ activeSubscriberCount, onSent }: Props) {
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<"warm" | "cold" | "all">("all");

  const loadPreview = useCallback(() => previewVintedCampaign(segment), [segment]);
  const sendTest = useCallback(() => sendVintedTestEmail(segment), [segment]);
  const sendAll = useCallback(
    (confirmation: string) => sendVintedTcCampaign(segment, confirmation),
    [segment],
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Vinted T&amp;C kampaň — 28. dubna ({activeSubscriberCount})
          </h3>
        </div>

        <fieldset className="mb-3 border-0 p-0">
          <legend className="sr-only">Segment</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                { value: "all", label: "Auto-segment", description: "Warm 90d / Cold starší" },
                { value: "warm", label: "Warm", description: "Přihlášení do 90 dnů" },
                { value: "cold", label: "Cold", description: "Starší odběratelé" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-2.5 text-xs transition-colors ${
                  segment === opt.value
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-white text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="vinted-segment"
                  value={opt.value}
                  checked={segment === opt.value}
                  onChange={() => setSegment(opt.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-[11px] text-muted-foreground">{opt.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90"
        >
          <ShieldAlert className="size-4" />
          Otevřít dry-run — {segment === "all" ? "auto-segment" : segment}
        </button>
      </div>

      <CampaignDryRunDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Vinted T&C kampaň (${segment === "all" ? "auto-segment" : segment})`}
        accentColor="primary"
        loadPreview={loadPreview}
        sendTest={sendTest}
        sendAll={sendAll}
        onSent={onSent}
        confirmationWord="ODESLAT VINTED"
      />
    </div>
  );
}
