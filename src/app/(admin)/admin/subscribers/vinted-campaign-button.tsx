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
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary shadow-sm transition-colors hover:bg-primary/10"
        >
          <ShieldAlert className="size-4" />
          Vinted kampaň ({activeSubscriberCount})
        </button>

        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Segment</legend>
          {(
            [
              { value: "all", label: "Auto-segment" },
              { value: "warm", label: "Warm" },
              { value: "cold", label: "Cold" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors ${
                segment === opt.value
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50"
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
              {opt.label}
            </label>
          ))}
        </fieldset>
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
      />
    </div>
  );
}
