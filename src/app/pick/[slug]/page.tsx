import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { PickPageClient } from "./pick-client";

export async function generateStaticParams() {
  try {
    const db = await getDb();
    const picks = await db.devPick.findMany({
      where: { status: "pending" },
      select: { slug: true },
    });
    if (picks.length === 0) return [{ slug: "_placeholder" }];
    return picks.map((p) => ({ slug: p.slug }));
  } catch {
    return [{ slug: "_placeholder" }];
  }
}


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "_placeholder") {
    return { title: "Výběr | Janička" };
  }
  await connection();
  const db = await getDb();
  const pick = await db.devPick.findUnique({ where: { slug } });
  return {
    title: pick ? `${pick.title} | Janička` : "Výběr | Janička",
  };
}

async function PickContent({ slug }: { slug: string }) {
  await connection();
  const db = await getDb();
  const pick = await db.devPick.findUnique({ where: { slug } });

  if (!pick) {
    notFound();
  }

  // Check expiry server-side
  let status = pick.status;
  if (status === "pending" && pick.expiresAt && new Date() > pick.expiresAt) {
    await db.devPick.update({
      where: { slug },
      data: { status: "expired" },
    });
    status = "expired";
  }

  const pickData = {
    id: pick.id,
    slug: pick.slug,
    title: pick.title,
    description: pick.description,
    pickType: pick.pickType as "choice" | "text" | "rating" | "image_choice",
    options: JSON.parse(pick.options) as PickOption[],
    selectedOption: pick.selectedOption,
    customText: pick.customText,
    status: status as "pending" | "answered" | "expired" | "superseded",
    answeredAt: pick.answeredAt?.toISOString() ?? null,
    expiresAt: pick.expiresAt?.toISOString() ?? null,
  };

  return <PickPageClient pick={pickData} />;
}

function PickFallback() {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-rose-50 via-white to-rose-50/30 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-rose-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Načítám...</p>
      </div>
    </main>
  );
}

export default async function PickPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <Suspense fallback={<PickFallback />}>
      <PickContent slug={slug} />
    </Suspense>
  );
}

export interface PickOption {
  label: string;
  value: string;
  image?: string;
  description?: string;
}
