"use client";

import { useCallback, useState } from "react";
import { Heart } from "lucide-react";
import {
  sendMothersDayCampaign,
  previewMothersDayCampaign,
  sendMothersDayTestEmail,
} from "./actions";
import type { MothersDayEmailNumber } from "@/lib/email";
import { CampaignDryRunDialog } from "./campaign-dry-run-dialog";

interface Props {
  activeSubscriberCount: number;
  onSent?: () => void;
}

const EMAIL_OPTIONS: {
  value: MothersDayEmailNumber;
  label: string;
  date: string;
  description: string;
}[] = [
  {
    value: 1,
    label: "Warmup",
    date: "1. května",
    description: "Představení kampaně, persona grid, produkty. Warm/cold segmentace.",
  },
  {
    value: 2,
    label: "Push",
    date: "7. května",
    description: "6 produktů se scarcity badge, urgence 3 dny do Dne matek.",
  },
  {
    value: 3,
    label: "Urgency",
    date: "9. května",
    description: "3 hero produkty, doprava zdarma nad 1 500 Kč, poslední šance.",
  },
];

export function MothersDayCampaignButton({ activeSubscriberCount, onSent }: Props) {
  const [selected, setSelected] = useState<MothersDayEmailNumber>(1);
  const [open, setOpen] = useState(false);

  const loadPreview = useCallback(() => previewMothersDayCampaign(selected), [selected]);
  const sendTest = useCallback(() => sendMothersDayTestEmail(selected), [selected]);
  const sendAll = useCallback(
    (confirmation: string) => sendMothersDayCampaign(selected, confirmation),
    [selected],
  );

  const active = EMAIL_OPTIONS.find((o) => o.value === selected)!;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Den matek 2026 — e-mailová kampaň ({activeSubscriberCount})
          </h3>
        </div>

        <fieldset className="mb-3 border-0 p-0">
          <legend className="sr-only">Vyberte e-mail</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {EMAIL_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-2.5 text-xs transition-colors ${
                  selected === opt.value
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-white text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="mothers-day-email"
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
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-95"
        >
          <Heart className="size-4" />
          Otevřít dry-run pro #{active.value} {active.label}
        </button>
      </div>

      <CampaignDryRunDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Den matek #${active.value} — ${active.label} (${active.date})`}
        accentColor="pink"
        loadPreview={loadPreview}
        sendTest={sendTest}
        sendAll={sendAll}
        onSent={onSent}
      />
    </div>
  );
}
