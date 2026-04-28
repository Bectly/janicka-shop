import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { estimateWeightG } from "@/lib/category-weights";

import { DistributeClient, type DraftRow, type CategoryRow } from "./distribute-client";

export const metadata: Metadata = {
  title: "Rozdělení nákladů | Admin",
};

interface PageProps {
  params: Promise<{ id: string; batchId: string }>;
}

export default async function DistributePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") notFound();

  const { id: bundleId, batchId } = await params;
  const db = await getDb();

  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      adminId: true,
      bundleId: true,
      bundle: {
        select: {
          id: true,
          totalPrice: true,
          totalKg: true,
          supplier: { select: { name: true } },
          invoiceNumber: true,
        },
      },
      bundleLine: {
        select: { name: true, totalPrice: true, kg: true },
      },
      drafts: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          categoryId: true,
          weightG: true,
          costBasis: true,
        },
      },
    },
  });

  if (!batch || batch.adminId !== session.user.id || batch.bundleId !== bundleId) {
    notFound();
  }

  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  // Total cost: prefer bundle line total when batch is scoped to a single line, else bundle total
  const totalCost = batch.bundleLine?.totalPrice ?? batch.bundle?.totalPrice ?? 0;
  const bundleName = batch.bundle?.supplier.name ?? "Balík";
  const lineLabel = batch.bundleLine?.name ?? null;

  const categoriesById = new Map(categories.map((c) => [c.id, c.name]));

  const drafts: DraftRow[] = batch.drafts.map((d) => {
    const catName = d.categoryId ? categoriesById.get(d.categoryId) ?? null : null;
    const defaultWeight = estimateWeightG(catName);
    return {
      id: d.id,
      name: d.name ?? "(bez názvu)",
      categoryId: d.categoryId ?? null,
      categoryName: catName,
      weightG: d.weightG ?? defaultWeight,
      costBasis: d.costBasis ?? null,
    };
  });

  const categoryRows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    estimateG: estimateWeightG(c.name),
  }));

  return (
    <>
      <div className="mb-4">
        <Link
          href={`/admin/bundles/${bundleId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {bundleName}
          {batch.bundle?.invoiceNumber ? ` — ${batch.bundle.invoiceNumber}` : ""}
        </Link>
      </div>

      <h1 className="font-heading text-2xl font-bold text-foreground">
        Rozdělení nákladů na kousky
      </h1>
      {lineLabel ? (
        <p className="mt-1 text-sm text-muted-foreground">Linka: {lineLabel}</p>
      ) : null}

      <DistributeClient
        bundleId={bundleId}
        batchId={batchId}
        totalCost={totalCost}
        drafts={drafts}
        categories={categoryRows}
      />
    </>
  );
}
