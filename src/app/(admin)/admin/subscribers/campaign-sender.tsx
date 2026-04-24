"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, CheckCircle, AlertCircle, History } from "lucide-react";
import {
  sendNewsletterCampaign,
  getCampaignHistory,
} from "./actions";
import { formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CollectionOption {
  id: string;
  title: string;
  productCount: number;
}

interface CampaignHistoryItem {
  id: string;
  subject: string;
  sentCount: number;
  failedCount: number;
  status: string;
  createdAt: Date;
}

interface Props {
  collections: CollectionOption[];
  activeSubscriberCount: number;
  initialHistory: CampaignHistoryItem[];
}

export function CampaignSender({
  collections,
  activeSubscriberCount,
  initialHistory,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [history, setHistory] = useState(initialHistory);

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await sendNewsletterCampaign(formData);
      if (res.success) {
        setResult({
          type: "success",
          message: `Odesláno ${res.sentCount} odběratelům${res.failedCount > 0 ? `, ${res.failedCount} selhalo` : ""}.`,
        });
        setShowForm(false);
        // Refresh history
        const updated = await getCampaignHistory();
        setHistory(updated);
      } else {
        setResult({
          type: "error",
          message: res.error ?? "Nepodařilo se odeslat kampaň.",
        });
      }
    });
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Toggle button */}
      {!showForm && (
        <Button
          type="button"
          onClick={() => {
            setShowForm(true);
            setResult(null);
          }}
        >
          <Send className="size-4" />
          Odeslat kampaň
        </Button>
      )}

      {/* Result message */}
      {result && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            result.type === "success"
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {result.type === "success" ? (
            <CheckCircle className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          {result.message}
        </div>
      )}

      {/* Campaign form */}
      {showForm && (
        <form
          action={handleSubmit}
          className="rounded-xl border bg-card p-6 shadow-sm"
        >
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            Nová newsletter kampaň
          </h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Bude odesláno{" "}
            <strong className="text-foreground">{activeSubscriberCount}</strong>{" "}
            aktivním odběratelům.
          </p>

          <div className="space-y-4">
            {/* Subject */}
            <div>
              <Label htmlFor="campaign-subject" className="mb-1">
                Předmět e-mailu *
              </Label>
              <Input
                id="campaign-subject"
                name="subject"
                type="text"
                required
                placeholder="Např: Den matek — darujte styl"
              />
            </div>

            {/* Preview text */}
            <div>
              <Label htmlFor="campaign-preview" className="mb-1">
                Náhledový text
              </Label>
              <Input
                id="campaign-preview"
                name="previewText"
                type="text"
                placeholder="Text zobrazený v náhledu e-mailu (volitelné)"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Zobrazí se v e-mailovém klientu před otevřením zprávy.
              </p>
            </div>

            {/* Heading */}
            <div>
              <Label htmlFor="campaign-heading" className="mb-1">
                Nadpis v e-mailu *
              </Label>
              <Input
                id="campaign-heading"
                name="heading"
                type="text"
                required
                placeholder="Např: Darujte něco, co má příběh"
              />
            </div>

            {/* Body text */}
            <div>
              <Label htmlFor="campaign-body" className="mb-1">
                Text zprávy
              </Label>
              <Textarea
                id="campaign-body"
                name="bodyText"
                rows={4}
                placeholder="Volitelný text pod nadpisem..."
                className="resize-y"
              />
            </div>

            {/* Collection picker */}
            <div>
              <Label htmlFor="campaign-collection" className="mb-1">
                Kolekce produktů (volitelné)
              </Label>
              <select
                id="campaign-collection"
                name="collectionId"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
              >
                <option value="">Bez produktů — jen text</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.productCount} produktů)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Vybrané produkty se zobrazí jako mřížka v e-mailu (max 8).
              </p>
            </div>

            {/* CTA text */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="campaign-cta-text" className="mb-1">
                  Text tlačítka
                </Label>
                <Input
                  id="campaign-cta-text"
                  name="ctaText"
                  type="text"
                  placeholder="Prohlédnout"
                  defaultValue="Prohlédnout novinky"
                />
              </div>
              <div>
                <Label htmlFor="campaign-cta-url" className="mb-1">
                  URL tlačítka
                </Label>
                <Input
                  id="campaign-cta-url"
                  name="ctaUrl"
                  type="url"
                  placeholder="https://jvsatnik.cz/products"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Prázdné = odkaz na novinky.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Odesílám...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Odeslat kampaň
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
              disabled={isPending}
            >
              Zrušit
            </Button>
          </div>
        </form>
      )}

      {/* Campaign history */}
      {history.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <History className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">
              Historie kampaní
            </h3>
          </div>
          <div className="divide-y">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {h.subject}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(h.createdAt)}
                  </p>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-2 text-xs">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {h.sentCount} odesláno
                  </span>
                  {h.failedCount > 0 && (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                      {h.failedCount} selhalo
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
