"use client";

import { useState, useTransition } from "react";
import type { PickOption } from "./page";

interface PickData {
  id: string;
  slug: string;
  title: string;
  description: string;
  pickType: "choice" | "text" | "rating" | "image_choice";
  options: PickOption[];
  selectedOption: string | null;
  customText: string | null;
  status: "pending" | "answered" | "expired" | "superseded";
  answeredAt: string | null;
  expiresAt: string | null;
}

export function PickPageClient({ pick }: { pick: PickData }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(pick.status === "answered");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (pick.status === "expired") {
    return (
      <PageShell>
        <StatusCard
          icon="⏰"
          title="Tento výběr vypršel"
          subtitle="Tým vybral za tebe — neboj, dopadlo to dobře!"
        />
      </PageShell>
    );
  }

  if (pick.status === "superseded") {
    return (
      <PageShell>
        <StatusCard
          icon="🔄"
          title="Tento výběr byl nahrazen"
          subtitle="Máš novější verzi — podívej se do chatu."
        />
      </PageShell>
    );
  }

  if (submitted || pick.status === "answered") {
    return (
      <PageShell>
        <StatusCard
          icon="💝"
          title="Díky! Předám vývojářům."
          subtitle={
            pick.selectedOption || selected
              ? `Vybrala jsi: ${pick.selectedOption || selected}`
              : "Tvoje odpověď je zaznamenána."
          }
        />
      </PageShell>
    );
  }

  function handleSubmit() {
    setError(null);

    let selectedOption: string | undefined;
    let customText: string | undefined;

    if (pick.pickType === "text") {
      if (!textValue.trim()) {
        setError("Napiš prosím odpověď.");
        return;
      }
      customText = textValue.trim();
    } else if (pick.pickType === "rating") {
      if (rating === 0) {
        setError("Vyber prosím hodnocení.");
        return;
      }
      selectedOption = String(rating);
      if (comment.trim()) customText = comment.trim();
    } else {
      if (!selected) {
        setError("Vyber prosím jednu z možností.");
        return;
      }
      selectedOption = selected;
      if (comment.trim()) customText = comment.trim();
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/dev-picks/${pick.slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selectedOption, customText }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Něco se pokazilo.");
          return;
        }

        setSubmitted(true);
      } catch {
        setError("Nepodařilo se odeslat. Zkus to znovu.");
      }
    });
  }

  return (
    <PageShell>
      <div className="w-full max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            {pick.title}
          </h1>
          {pick.description && (
            <p className="text-gray-600 text-base sm:text-lg">
              {pick.description}
            </p>
          )}
        </div>

        {/* Pick type content */}
        <div className="space-y-4">
          {(pick.pickType === "choice" || pick.pickType === "image_choice") && (
            <ChoiceSelector
              options={pick.options}
              selected={selected}
              onSelect={setSelected}
              hasImages={pick.pickType === "image_choice"}
            />
          )}

          {pick.pickType === "text" && (
            <TextInput value={textValue} onChange={setTextValue} />
          )}

          {pick.pickType === "rating" && (
            <RatingInput rating={rating} onRate={setRating} />
          )}

          {/* Comment field for choice/rating types */}
          {(pick.pickType === "choice" ||
            pick.pickType === "image_choice" ||
            pick.pickType === "rating") && (
            <div className="mt-4">
              <label className="block text-sm text-gray-500 mb-1">
                Komentář (volitelné)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 focus:outline-none resize-none"
                rows={2}
                placeholder="Chceš k tomu něco dodat?"
                maxLength={2000}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full mt-6 py-4 rounded-xl bg-rose-500 text-white font-semibold text-lg hover:bg-rose-600 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-500/25"
          >
            {isPending ? "Odesílám..." : "Potvrdit výběr"}
          </button>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-rose-50 via-white to-rose-50/30 flex items-center justify-center p-4 sm:p-8">
      {children}
    </main>
  );
}

function StatusCard({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center max-w-md mx-auto">
      <div className="text-5xl mb-4">{icon}</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-600">{subtitle}</p>
    </div>
  );
}

function ChoiceSelector({
  options,
  selected,
  onSelect,
  hasImages,
}: {
  options: PickOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  hasImages: boolean;
}) {
  return (
    <div
      className={
        hasImages
          ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
          : "flex flex-col gap-3"
      }
    >
      {options.map((option) => {
        const isSelected = selected === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={`group relative rounded-2xl border-2 p-4 text-left transition-all ${
              isSelected
                ? "border-rose-500 bg-rose-50 shadow-lg shadow-rose-500/10"
                : "border-gray-200 bg-white hover:border-rose-300 hover:shadow-md"
            }`}
          >
            {hasImages && option.image && (
              <div className="mb-3 rounded-xl overflow-hidden aspect-[4/3] bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={option.image}
                  alt={option.label}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${
                  isSelected
                    ? "border-rose-500 bg-rose-500"
                    : "border-gray-300 group-hover:border-rose-400"
                }`}
              >
                {isSelected && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={`font-medium ${isSelected ? "text-rose-900" : "text-gray-900"}`}
                >
                  {option.label}
                </p>
                {option.description && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {option.description}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-gray-200 px-4 py-4 text-gray-900 placeholder-gray-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-100 focus:outline-none resize-none text-lg"
      rows={4}
      placeholder="Napiš svoji odpověď..."
      maxLength={5000}
      autoFocus
    />
  );
}

function RatingInput({
  rating,
  onRate,
}: {
  rating: number;
  onRate: (n: number) => void;
}) {
  return (
    <div className="flex justify-center gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onRate(star)}
          className="transition-transform hover:scale-110 active:scale-95"
          aria-label={`${star} z 5`}
        >
          <svg
            className={`w-12 h-12 sm:w-14 sm:h-14 ${
              star <= rating ? "text-yellow-400" : "text-gray-300"
            }`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
