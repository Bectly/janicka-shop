import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { getDb } from "@/lib/db";
import { readDraftSession } from "@/lib/draft-session";

import { continueExistingBatchAction, startNewBatchAction } from "./actions";

export const metadata: Metadata = {
  title: "Pokračovat / nový batch | Janička",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ batchId?: string }>;
}

const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatStartedAt(d: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

function shortBatchId(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}

async function MobileStartGate({ searchParams }: PageProps) {
  await connection();
  const session = await readDraftSession();
  const { batchId: rawNewBatchId } = await searchParams;

  if (!session) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Relace vypršela
        </h1>
        <p className="text-sm text-muted-foreground">
          Naskenuj prosím znovu QR kód z počítače. Odkaz platí jen 15 minut.
        </p>
      </main>
    );
  }

  const newBatchId = rawNewBatchId && rawNewBatchId === session.batchId ? rawNewBatchId : session.batchId;

  const db = await getDb();
  // eslint-disable-next-line react-hooks/purity -- request-time read in RSC, not cached
  const cutoff = new Date(Date.now() - RESUME_WINDOW_MS);

  // Look for ANOTHER open batch by the same admin with recent activity and at least one draft.
  const candidate = await db.productDraftBatch.findFirst({
    where: {
      adminId: session.adminId,
      status: "open",
      lastActivityAt: { gt: cutoff },
      id: { not: newBatchId },
      drafts: { some: {} },
    },
    select: {
      id: true,
      createdAt: true,
      lastActivityAt: true,
      _count: { select: { drafts: true } },
    },
    orderBy: { lastActivityAt: "desc" },
  });

  if (!candidate) {
    redirect(`/admin/drafts/${encodeURIComponent(newBatchId)}/mobile`);
  }

  const count = candidate._count.drafts;
  const kousek = count === 1 ? "kousek" : count >= 2 && count <= 4 ? "kousky" : "kousků";

  return (
    <main
      className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-6 px-6 py-10"
      style={{
        paddingTop: "max(2.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Najdeš svoji rozdělanou práci?
        </h1>
        <p className="text-sm text-muted-foreground">
          Z předchozí relace ti zbyl otevřený batch. Můžeš v něm pokračovat,
          nebo začít čistý nový.
        </p>
      </header>

      <form action={continueExistingBatchAction} className="contents">
        <input type="hidden" name="targetBatchId" value={candidate.id} />
        <input type="hidden" name="newBatchId" value={newBatchId} />
        <button
          type="submit"
          className="rounded-lg border border-foreground bg-foreground px-4 py-4 text-left text-background shadow-sm transition active:scale-[0.99]"
        >
          <span className="block text-base font-semibold">
            Pokračovat v batchi {shortBatchId(candidate.id)}
          </span>
          <span className="block text-sm opacity-80">
            {count} {kousek} · začato {formatStartedAt(candidate.createdAt)}
          </span>
        </button>
      </form>

      <form action={startNewBatchAction} className="contents">
        <input type="hidden" name="newBatchId" value={newBatchId} />
        <button
          type="submit"
          className="rounded-lg border border-border bg-background px-4 py-4 text-left text-foreground transition active:scale-[0.99]"
        >
          <span className="block text-base font-semibold">Začít nový batch</span>
          <span className="block text-sm text-muted-foreground">
            Předchozí kousky zůstanou uložené, můžeš je doplnit později.
          </span>
        </button>
      </form>
    </main>
  );
}

export default function MobileStartPage({ searchParams }: PageProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center px-6 py-12">
          <p className="text-sm text-muted-foreground">Načítám…</p>
        </main>
      }
    >
      <MobileStartGate searchParams={searchParams} />
    </Suspense>
  );
}
