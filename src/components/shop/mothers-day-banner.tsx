import Link from "next/link";
import { getDb } from "@/lib/db";
import { ArrowRight, Flower2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Visible May 1–10, 2026 (CEST)
const SHOW_FROM = new Date("2026-05-01T00:00:00+02:00");
const SHOW_UNTIL = new Date("2026-05-11T00:00:00+02:00"); // May 10 inclusive

const MOTHERS_DAY_YEAR = 2026;
const MOTHERS_DAY_MONTH = 5; // May
const MOTHERS_DAY_DAY = 10;

function daysUntilMothersDay(now: Date): number {
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const todayUtc = Date.UTC(
    Number(todayStr.slice(0, 4)),
    Number(todayStr.slice(5, 7)) - 1,
    Number(todayStr.slice(8, 10)),
  );
  const targetUtc = Date.UTC(MOTHERS_DAY_YEAR, MOTHERS_DAY_MONTH - 1, MOTHERS_DAY_DAY);
  return Math.floor((targetUtc - todayUtc) / 86_400_000);
}

function formatDaysLabel(days: number): string {
  if (days >= 5) return `Za ${days} dní`;
  if (days >= 2) return `Za ${days} dny`;
  return `Za ${days} den`;
}

export async function MothersDayBanner() {
  const now = new Date();
  if (now < SHOW_FROM || now >= SHOW_UNTIL) return null;

  const db = await getDb();
  const collection = await db.collection.findUnique({
    where: { slug: "den-matek-2026" },
    select: { id: true, active: true },
  });

  const href =
    collection && collection.active
      ? "/collections/den-matek-2026"
      : "/products?new=1";

  const days = daysUntilMothersDay(now);
  const lastChance = days <= 1;
  const badgeLabel =
    days <= 0 ? "Dnes je Den matek!" : days === 1 ? "Poslední šance!" : formatDaysLabel(days);

  const sectionClass = lastChance
    ? "bg-gradient-to-r from-brand/30 via-brand-light/60 to-brand/30"
    : "bg-gradient-to-r from-brand-light/20 via-blush-dark/40 to-brand-light/20";

  const badgeClass = lastChance
    ? "bg-brand text-white"
    : "bg-white/80 text-brand-dark";

  return (
    <section className={sectionClass}>
      <div className="mx-auto max-w-7xl px-4 py-10 text-center sm:px-6 sm:py-14 lg:px-8">
        <div className="flex flex-col items-center gap-3">
          <Flower2 className="size-10 text-brand sm:size-12" aria-hidden="true" />
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide sm:text-sm ${badgeClass}`}
          >
            {badgeLabel}
          </span>
        </div>
        <h2 className="mt-3 font-heading text-2xl font-bold text-brand-dark sm:text-3xl">
          Najdi mámě jedinečný kousek
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-brand-dark/70 sm:text-base">
          Daruj second hand místo masové výroby — každý kousek je originál.
        </p>
        <div className="mt-6">
          <Button size="lg" render={<Link href={href} />}>
            Prohlédnout kolekci
            <ArrowRight data-icon="inline-end" className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
