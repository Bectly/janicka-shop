"use server";

import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { rateLimitAdmin } from "@/lib/rate-limit";

const VALID_STATUSES = new Set(["ordered", "received", "unpacked", "done"]);

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
}

export async function updateBundleStatus(id: string, newStatus: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  if (!VALID_STATUSES.has(newStatus)) throw new Error("Neplatný stav");

  const db = await getDb();
  const bundle = await db.supplierBundle.findUnique({
    where: { id },
    select: { id: true, supplierId: true, status: true },
  });
  if (!bundle) throw new Error("Balík nenalezen");

  await db.supplierBundle.update({
    where: { id },
    data: {
      status: newStatus,
      ...(newStatus === "received" && bundle.status !== "received"
        ? { receivedDate: new Date() }
        : {}),
    },
  });

  revalidateTag(`admin-bundle:${id}`, "max");
  revalidateTag(`admin-supplier:${bundle.supplierId}`, "max");
  revalidateTag("admin-suppliers", "max");
}
