"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, CheckCircle, AlertCircle, History } from "lucide-react";
import {
  sendNewsletterCampaign,
  getCampaignHistory,
} from "./actions";
import { formatDate } from "@/lib/format";

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
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setResult(null);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Send className="size-4" />
          Odeslat kampaň
        </button>
      )}

      {/* Result message */}
      {result && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            result.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
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
              <label
                htmlFor="campaign-subject"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Předmět e-mailu *
              </label>
              <input
                id="campaign-subject"
                name="subject"
                type="text"
                required
                placeholder="Např: Den matek — darujte styl"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Preview text */}
            <div>
              <label
                htmlFor="campaign-preview"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Náhledový text
              </label>
              <input
                id="campaign-preview"
                name="previewText"
                type="text"
                placeholder="Text zobrazený v náhledu e-mailu (volitelné)"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Zobrazí se v e-mailovém klientu před otevřením zprávy.
              </p>
            </div>

            {/* Heading */}
            <div>
              <label
                htmlFor="campaign-heading"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Nadpis v e-mailu *
              </label>
              <input
                id="campaign-heading"
                name="heading"
                type="text"
                required
                placeholder="Např: Darujte něco, co má příběh"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Body text */}
            <div>
              <label
                htmlFor="campaign-body"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Text zprávy
              </label>
              <textarea
                id="campaign-body"
                name="bodyText"
                rows={4}
                placeholder="Volitelný text pod nadpisem..."
                className="w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Collection picker */}
            <div>
              <label
                htmlFor="campaign-collection"
                className="mb-1 block text-sm font-medium text-foreground"
              >
                Kolekce produktů (volitelné)
              </label>
              <select
                id="campaign-collection"
                name="collectionId"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
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
                <label
                  htmlFor="campaign-cta-text"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  Text tlačítka
                </label>
                <input
                  id="campaign-cta-text"
                  name="ctaText"
                  type="text"
                  placeholder="Prohlédnout"
                  defaultValue="Prohlédnout novinky"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="campaign-cta-url"
                  className="mb-1 block text-sm font-medium text-foreground"
                >
                  URL tlačítka
                </label>
                <input
                  id="campaign-cta-url"
                  name="ctaUrl"
                  type="url"
                  placeholder="https://janicka-shop.vercel.app/products"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Prázdné = odkaz na novinky.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
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
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={isPending}
              className="rounded-lg border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Zrušit
            </button>
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
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                    {h.sentCount} odesláno
                  </span>
                  {h.failedCount > 0 && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
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
