import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Metadata } from "next";

import { MobileAddForm } from "./mobile-add-form";

export const metadata: Metadata = {
  title: "Přidat z mobilu | Janička",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ batchId: string }>;
}

async function MobileGate({ params }: { params: Promise<{ batchId: string }> }) {
  await connection();
  const { batchId } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get("draft_session")?.value ?? "";
  const [sessionBatchId] = session.split(":");
  const authorized = sessionBatchId === batchId && batchId.length > 0;

  if (!authorized) {
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

  return <MobileAddForm batchId={batchId} />;
}

export default function MobileDraftAddPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center px-6 py-12">
          <p className="text-sm text-muted-foreground">Načítám…</p>
        </main>
      }
    >
      <MobileGate params={params} />
    </Suspense>
  );
}
