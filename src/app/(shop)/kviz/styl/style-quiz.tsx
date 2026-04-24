"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitStyleQuiz } from "@/app/(shop)/actions";
import { CUSTOMER_EMAIL_KEY } from "@/components/shop/browse-abandonment-tracker";

const STORAGE_KEY = "janicka:style-quiz:v1";

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const STYLE_OPTIONS = [
  {
    value: "casual",
    label: "Casual",
    description: "Pohodlné kousky pro každý den",
  },
  {
    value: "elegant",
    label: "Elegantní",
    description: "Šaty, sukně, jemné materiály",
  },
  {
    value: "street",
    label: "Street",
    description: "Mikiny, oversized, energie města",
  },
  {
    value: "boho",
    label: "Boho",
    description: "Vzory, volný střih, přírodní tóny",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Čisté linie, neutrální barvy",
  },
] as const;

const CONDITION_OPTIONS = [
  {
    value: "new_only",
    label: "Jen nové s visačkou",
    description: "Nepoužité kousky bez známek nošení",
  },
  {
    value: "any",
    label: "Jakýkoliv stav",
    description: "Otevřená i opotřebovaným pokladům",
  },
] as const;

const COLOR_OPTIONS = [
  { name: "Černá", hex: "#000000" },
  { name: "Bílá", hex: "#FFFFFF" },
  { name: "Béžová", hex: "#D2B48C" },
  { name: "Krémová", hex: "#FFFDD0" },
  { name: "Šedá", hex: "#6B7280" },
  { name: "Růžová", hex: "#EC4899" },
  { name: "Červená", hex: "#DC2626" },
  { name: "Modrá", hex: "#2563EB" },
  { name: "Zelená", hex: "#16A34A" },
  { name: "Hnědá", hex: "#92400E" },
] as const;

const PRICE_OPTIONS = [
  { value: 200, label: "do 200 Kč" },
  { value: 500, label: "do 500 Kč" },
  { value: 800, label: "do 800 Kč" },
  { value: 1500, label: "do 1 500 Kč" },
  { value: null as number | null, label: "Bez limitu" },
] as const;

type StyleValue = (typeof STYLE_OPTIONS)[number]["value"];
type ConditionValue = (typeof CONDITION_OPTIONS)[number]["value"];

interface QuizState {
  sizes: string[];
  style: StyleValue | null;
  conditionTolerance: ConditionValue | null;
  colors: string[];
  maxPrice: number | null;
}

const EMPTY: QuizState = {
  sizes: [],
  style: null,
  conditionTolerance: null,
  colors: [],
  maxPrice: null,
};

function loadState(): QuizState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<QuizState>;
    return {
      sizes: Array.isArray(parsed.sizes) ? parsed.sizes.slice(0, 12) : [],
      style:
        STYLE_OPTIONS.some((s) => s.value === parsed.style)
          ? (parsed.style as StyleValue)
          : null,
      conditionTolerance:
        CONDITION_OPTIONS.some((c) => c.value === parsed.conditionTolerance)
          ? (parsed.conditionTolerance as ConditionValue)
          : null,
      colors: Array.isArray(parsed.colors) ? parsed.colors.slice(0, 10) : [],
      maxPrice:
        typeof parsed.maxPrice === "number" || parsed.maxPrice === null
          ? parsed.maxPrice
          : null,
    };
  } catch {
    return EMPTY;
  }
}

export function StyleQuiz() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<QuizState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [actionState, formAction, isPending] = useActionState(
    submitStyleQuiz,
    null,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe localStorage hydration: reading during render would cause CSR/SSR markup mismatch. Matches C4817 Lead decision pattern for localStorage hydration sites.
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage unavailable — silent
    }
  }, [state, hydrated]);

  // Handle successful submit: clear localStorage + redirect
  useEffect(() => {
    if (actionState?.success && actionState.redirectUrl) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      router.push(actionState.redirectUrl);
    }
  }, [actionState, router]);

  const totalSteps = 6; // 5 questions + email
  const progress = Math.min(100, Math.round(((step + 1) / totalSteps) * 100));

  const canAdvance = useMemo(() => {
    switch (step) {
      case 0:
        return state.sizes.length > 0;
      case 1:
        return state.style !== null;
      case 2:
        return state.conditionTolerance !== null;
      case 3:
        return state.colors.length > 0;
      case 4:
        // maxPrice can be null ("bez limitu") — but user must explicitly pick
        return state.maxPrice !== null || step === 4;
      default:
        return true;
    }
  }, [step, state]);

  function toggleSize(size: string) {
    setState((s) => ({
      ...s,
      sizes: s.sizes.includes(size)
        ? s.sizes.filter((x) => x !== size)
        : [...s.sizes, size],
    }));
  }
  function toggleColor(color: string) {
    setState((s) => ({
      ...s,
      colors: s.colors.includes(color)
        ? s.colors.filter((x) => x !== color)
        : [...s.colors, color],
    }));
  }

  // For email step: prefill from localStorage if available
  const prefilledEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(CUSTOMER_EMAIL_KEY) ?? "";
    } catch {
      return "";
    }
  }, []);

  return (
    <div>
      {/* Progress */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Sparkles className="size-3.5" /> Kvíz: Najdi svůj styl
          </span>
          <span>
            Krok {Math.min(step + 1, totalSteps)} / {totalSteps}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {step === 0 && (
        <Step
          title="Jakou velikost nosíš?"
          subtitle="Vyberte všechny velikosti, ve kterých se cítíte dobře."
        >
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {SIZE_OPTIONS.map((s) => {
              const active = state.sizes.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className={`flex min-h-[48px] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-foreground/40"
                  }`}
                  aria-pressed={active}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </Step>
      )}

      {step === 1 && (
        <Step
          title="Jaký styl je vám nejbližší?"
          subtitle="Vyberte jeden — pomůže nám navrhnout výběr."
        >
          <div className="flex flex-col gap-2.5">
            {STYLE_OPTIONS.map((opt) => {
              const active = state.style === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, style: opt.value }))}
                  className={`flex min-h-[64px] items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-foreground/40"
                  }`}
                  aria-pressed={active}
                >
                  <span
                    className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {active && <Check className="size-3" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {opt.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Step>
      )}

      {step === 2 && (
        <Step
          title="Jaký stav je pro vás přijatelný?"
          subtitle="Každý kus osobně kontrolujeme — vy si vyberete míru."
        >
          <div className="flex flex-col gap-2.5">
            {CONDITION_OPTIONS.map((opt) => {
              const active = state.conditionTolerance === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setState((s) => ({ ...s, conditionTolerance: opt.value }))
                  }
                  className={`flex min-h-[64px] items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-foreground/40"
                  }`}
                  aria-pressed={active}
                >
                  <span
                    className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {active && <Check className="size-3" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {opt.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Step>
      )}

      {step === 3 && (
        <Step
          title="Které barvy máte rádi?"
          subtitle="Vyberte alespoň jednu — klidně i víc."
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {COLOR_OPTIONS.map((c) => {
              const active = state.colors.includes(c.name);
              const isLight = ["#FFFFFF", "#FFFDD0", "#D2B48C"].includes(c.hex);
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => toggleColor(c.name)}
                  className={`flex min-h-[48px] items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-foreground/40"
                  }`}
                  aria-pressed={active}
                >
                  <span
                    className="inline-block size-5 shrink-0 rounded-full border border-border/60"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden
                  />
                  <span className="truncate">{c.name}</span>
                  {active && (
                    <Check
                      className={`ml-auto size-4 ${isLight ? "text-foreground" : "text-primary"}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </Step>
      )}

      {step === 4 && (
        <Step
          title="Kolik chcete maximálně utratit?"
          subtitle="Pomůže nám hned filtrovat výběr."
        >
          <div className="flex flex-col gap-2.5">
            {PRICE_OPTIONS.map((opt) => {
              const active = state.maxPrice === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() =>
                    setState((s) => ({ ...s, maxPrice: opt.value }))
                  }
                  className={`flex min-h-[48px] items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:border-foreground/40"
                  }`}
                  aria-pressed={active}
                >
                  <span
                    className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {active && <Check className="size-3" />}
                  </span>
                  <span className="font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </Step>
      )}

      {step === 5 && (
        <form action={formAction} className="space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Kam vám pošleme nové kousky?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Uložíme váš výběr a jednou týdně vám pošleme novinky přesně podle
              vašich preferencí. Odhlásit se můžete kdykoliv.
            </p>
          </div>

          {/* Hidden fields with quiz answers */}
          {state.sizes.map((s) => (
            <input key={`s-${s}`} type="hidden" name="sizes" value={s} />
          ))}
          {state.colors.map((c) => (
            <input key={`c-${c}`} type="hidden" name="colors" value={c} />
          ))}
          <input type="hidden" name="style" value={state.style ?? ""} />
          <input
            type="hidden"
            name="conditionTolerance"
            value={state.conditionTolerance ?? ""}
          />
          <input
            type="hidden"
            name="maxPrice"
            value={state.maxPrice === null ? "" : String(state.maxPrice)}
          />

          <label htmlFor="quiz-email" className="block text-sm font-medium">
            Váš e-mail
            <input
              id="quiz-email"
              type="email"
              name="email"
              required
              maxLength={254}
              autoComplete="email"
              defaultValue={prefilledEmail}
              placeholder="vase@email.cz"
              className="mt-1.5 block w-full rounded-lg border border-border bg-background px-4 py-3 text-base outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          {actionState && !actionState.success && (
            <p role="alert" className="text-sm text-destructive">
              {actionState.message}
            </p>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => setStep(4)}
              disabled={isPending}
            >
              <ArrowLeft className="size-4" /> Zpět
            </Button>
            <Button type="submit" size="lg" disabled={isPending}>
              {isPending ? "Odesílám…" : "Ukázat můj výběr"}
              {!isPending && <ArrowRight className="size-4" />}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Odesláním souhlasíte se zasíláním novinek. Vaše data nesdílíme.
          </p>
        </form>
      )}

      {step < 5 && (
        <div className="mt-8 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="size-4" /> Zpět
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance}
          >
            Pokračovat <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}
