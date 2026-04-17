"use client";

import { useState, useTransition, useRef } from "react";
import { Eye, Send, Loader2, CheckCircle, AlertCircle, Mail } from "lucide-react";
import { previewCampaignEmail, sendCampaignTestEmail } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Collection {
  id: string;
  title: string;
  productCount: number;
}

interface Props {
  collections: Collection[];
}

type ActionResult = { type: "success" | "error"; message: string } | null;

export function EmailEditor({ collections }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const [subscriberCount, setSubscriberCount] = useState<number>(0);
  const [testResult, setTestResult] = useState<ActionResult>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isSending, startSend] = useTransition();
  const [collectionId, setCollectionId] = useState<string>("");

  function getFormData() {
    const form = formRef.current;
    if (!form) return new FormData();
    const fd = new FormData(form);
    if (collectionId && collectionId !== "none") {
      fd.set("collectionId", collectionId);
    } else {
      fd.delete("collectionId");
    }
    return fd;
  }

  function handlePreview() {
    startPreview(async () => {
      const fd = getFormData();
      const result = await previewCampaignEmail(fd);
      setPreviewHtml(result.html);
      setPreviewSubject(result.subject);
      setSubscriberCount(result.subscriberCount);
    });
  }

  function handleTestSend() {
    setTestResult(null);
    startSend(async () => {
      const fd = getFormData();
      const result = await sendCampaignTestEmail(fd);
      if (result.success) {
        setTestResult({
          type: "success",
          message: `Test odeslán na ${result.recipient}.`,
        });
      } else {
        setTestResult({
          type: "error",
          message: result.error ?? "Odeslání selhalo.",
        });
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Editor panel */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="font-heading text-lg font-semibold text-foreground">Obsah e-mailu</h2>
        <p className="mt-1 text-sm text-muted-foreground">Vyplňte pole a zobrazte náhled vpravo.</p>

        <form ref={formRef} className="mt-5 space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-1.5">
            <Label htmlFor="subject">Předmět *</Label>
            <Input
              id="subject"
              name="subject"
              placeholder="Nové kousky jsou tady 🛍️"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="previewText">Preview text</Label>
            <Input
              id="previewText"
              name="previewText"
              placeholder="Zobrazí se v náhledu e-mailu v doručené poště..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="heading">Nadpis e-mailu *</Label>
            <Input
              id="heading"
              name="heading"
              placeholder="Podívej se, co přibylo!"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bodyText">Text zprávy</Label>
            <Textarea
              id="bodyText"
              name="bodyText"
              rows={4}
              placeholder="Vybírali jsme za tebe. Nové kusy, nová sezóna..."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="collectionId">Kolekce produktů (volitelné)</Label>
            <Select value={collectionId} onValueChange={(v) => setCollectionId(v ?? "")}>
              <SelectTrigger id="collectionId">
                <SelectValue placeholder="Vybrat kolekci…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bez kolekce</SelectItem>
                {collections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title} ({c.productCount} produktů)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ctaText">Text tlačítka</Label>
              <Input
                id="ctaText"
                name="ctaText"
                placeholder="Prohlédnout"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctaUrl">URL odkaz</Label>
              <Input
                id="ctaUrl"
                name="ctaUrl"
                placeholder="/products?sort=newest"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreview}
              disabled={isPreviewing}
            >
              {isPreviewing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Eye className="size-4" />
              )}
              Náhled
            </Button>

            <Button
              type="button"
              onClick={handleTestSend}
              disabled={isSending}
            >
              {isSending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Test → mně
            </Button>
          </div>

          {/* Test send result */}
          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                testResult.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {testResult.type === "success" ? (
                <CheckCircle className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
              )}
              {testResult.message}
            </div>
          )}
        </form>

        {/* Subscriber count hint */}
        {subscriberCount > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            <Mail className="mr-1 inline size-3" />
            {subscriberCount} aktivních odběratelů — odeslání kampaně přes{" "}
            <a href="/admin/subscribers" className="underline hover:text-foreground">
              Newsletter
            </a>
          </p>
        )}
      </div>

      {/* Preview panel */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Náhled</h2>
            {previewSubject && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Předmět: <span className="font-medium text-foreground">{previewSubject}</span>
              </p>
            )}
          </div>
        </div>

        {previewHtml ? (
          <iframe
            srcDoc={previewHtml}
            title="Náhled e-mailu"
            className="h-[700px] w-full rounded-b-xl"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="flex h-[700px] flex-col items-center justify-center gap-3 text-muted-foreground">
            <Eye className="size-10 opacity-20" />
            <p className="text-sm">Klikněte na „Náhled" pro zobrazení.</p>
          </div>
        )}
      </div>
    </div>
  );
}
