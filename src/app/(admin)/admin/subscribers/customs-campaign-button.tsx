"use client";

import { useCallback, useState } from "react";
import { Package } from "lucide-react";
import {
  sendCustomsDutyCampaign,
  previewCustomsCampaign,
  sendCustomsTestEmail,
} from "./actions";
import type { CustomsEmailNumber } from "@/lib/email";
import { CampaignDryRunDialog } from "./campaign-dry-run-dialog";

interface Props {
  activeSubscriberCount: number;
  onSent?: () => void;
}

const EMAIL_OPTIONS: {
  value: CustomsEmailNumber;
  label: string;
  date: string;
  description: string;
}[] = [
  {
    value: 1,
    label: "Soft tease",
    date: "15. června",
    description: "Informační email o změnách v dovozu. Srovnání zahraničí vs. Janička.",
  },
  {
    value: 2,
    label: "Final push",
    date: "28. června",
    description: "Urgentní email 3 dny před změnou. Konkrétní cenové srovnání.",
  },
];

export function CustomsCampaignButton({ activeSubscriberCount, onSent }: Props) {
  const [selected, setSelected] = useState<CustomsEmailNumber>(1);
  const [open, setOpen] = useState(false);

  const loadPreview = useCallback(() => previewCustomsCampaign(selected), [selected]);
  const sendTest = useCallback(() => sendCustomsTestEmail(selected), [selected]);
  const sendAll = useCallback(
    (confirmation: string) => sendCustomsDutyCampaign(selected, confirmation),
    [selected],
  );

  const active = EMAIL_OPTIONS.find((o) => o.value === selected)!;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-muted-foreground/20 bg-muted/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            EU clo 2026 — e-mailová kampaň ({activeSubscriberCount})
          </h3>
        </div>

        <fieldset className="mb-3 border-0 p-0">
          <legend className="sr-only">Vyberte e-mail</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {EMAIL_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-2.5 text-xs transition-colors ${
                  selected === opt.value
                    ? "border-muted-foreground/40 bg-muted/50 text-foreground"
                    : "border-border bg-white text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="customs-email"
                  value={opt.value}
                  checked={selected === opt.value}
                  onChange={() => setSelected(opt.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium">
                  #{opt.value} {opt.label}
                </span>
                <span className="text-[11px] text-muted-foreground">({opt.date})</span>
                <span className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {opt.description}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Package className="size-4" />
          Otevřít dry-run pro #{active.value} {active.label}
        </button>
      </div>

      <CampaignDryRunDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`EU clo #${active.value} — ${active.label} (${active.date})`}
        accentColor="emerald"
        loadPreview={loadPreview}
        sendTest={sendTest}
        sendAll={sendAll}
        onSent={onSent}
      />
    </div>
  );
}
