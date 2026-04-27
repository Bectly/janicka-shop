import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

import { BatchReviewClient } from "./review-client";

export const metadata: Metadata = {
  title: "Revize batchí | Admin",
};

interface PageProps {
  params: Promise<{ batchId: string }>;
}

export default async function BatchReviewPage({ params }: PageProps) {
  await connection();
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    notFound();
  }

  const { batchId } = await params;
  const db = await getDb();

  const batch = await db.productDraftBatch.findUnique({
    where: { id: batchId },
    include: {
      drafts: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!batch || batch.adminId !== session.user.id) {
    notFound();
  }

  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const drafts = batch.drafts.map((d) => ({
    id: d.id,
    name: d.name,
    price: d.price,
    categoryId: d.categoryId,
    brand: d.brand,
    condition: d.condition,
    sizes: parseStringArray(d.sizes),
    images: parseImageUrls(d.images),
    description: d.description,
    measurements: d.measurements,
    fitNote: d.fitNote,
    defectsNote: d.defectsNote,
    internalNote: d.internalNote,
    status: d.status,
    publishedProductId: d.publishedProductId,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <BatchReviewClient
      batchId={batch.id}
      status={batch.status}
      sealedAt={batch.sealedAt?.toISOString() ?? null}
      createdAt={batch.createdAt.toISOString()}
      drafts={drafts}
      categories={categories}
    />
  );
}

function parseStringArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function parseImageUrls(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "url" in item) {
          const url = (item as { url: unknown }).url;
          return typeof url === "string" ? url : null;
        }
        return null;
      })
      .filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}
