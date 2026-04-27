"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  DRAFT_QR_TTL_SECONDS,
  hashDraftToken,
  signDraftQrToken,
} from "@/lib/draft-qr";

export async function startUnpackBatch(
  bundleId: string,
  formData: FormData,
): Promise<never> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  const adminId = session.user.id;

  const bundleLineId =
    (formData.get("bundleLineId") as string) || null;
  const defaultWeightG =
    parseInt(formData.get("defaultWeightG") as string) || null;

  const db = await getDb();
  const expiresAt = new Date(Date.now() + DRAFT_QR_TTL_SECONDS * 1000);

  const batch = await db.productDraftBatch.create({
    data: {
      adminId,
      tokenHash: "pending",
      expiresAt,
      status: "open",
      bundleId,
      bundleLineId: bundleLineId ?? undefined,
      defaultWeightG: defaultWeightG ?? undefined,
    },
    select: { id: true },
  });

  const token = await signDraftQrToken(
    { batchId: batch.id, adminId },
    DRAFT_QR_TTL_SECONDS,
  );
  const tokenHash = hashDraftToken(token);

  await db.productDraftBatch.update({
    where: { id: batch.id },
    data: { tokenHash },
  });

  redirect(`/admin/products?openQR=${batch.id}`);
}
