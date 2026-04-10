import Link from "next/link";
import { getDb } from "@/lib/db";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Visible May 1–10, 2026 (CEST)
const SHOW_FROM = new Date("2026-05-01T00:00:00+02:00");
const SHOW_UNTIL = new Date("2026-05-11T00:00:00+02:00"); // May 10 inclusive

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

  return (
    <section className="bg-gradient-to-r from-brand-light/20 via-blush-dark/40 to-brand-light/20">
      <div className="mx-auto max-w-7xl px-4 py-10 text-center sm:px-6 sm:py-14 lg:px-8">
        <p className="text-3xl sm:text-4xl">🌷</p>
        <h2 className="mt-3 font-heading text-2xl font-bold text-brand-dark sm:text-3xl">
          Najdi mámě jedinečný kousek
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-brand-dark/70 sm:text-base">
          Daruj second hand místo masové výroby — každý kousek je originál.
        </p>
        <div className="mt-6">
          <Button
            size="lg"
            render={<Link href={href} />}
          >
            Prohlédnout kolekci
            <ArrowRight data-icon="inline-end" className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
