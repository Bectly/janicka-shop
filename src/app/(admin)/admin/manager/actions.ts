"use server";

/**
 * Server actions for the /admin/manager page.
 *
 * All writes go to the JARVIS DB cross-app via `@/lib/jarvis-db`.
 * Auth: requires an admin session (matches existing admin pages).
 *
 * Plan: ~/.claude/plans/piped-orbiting-fox.md (MS-γ)
 */
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import {
  JANICKA_PROJECT_ID,
  startManagerSession,
  updateHumanTaskStatus,
} from "@/lib/jarvis-db";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function acceptTaskAction(taskId: number) {
  await requireAdmin();
  await updateHumanTaskStatus(taskId, "accepted");
  revalidatePath("/admin/manager");
}

export async function startTaskAction(taskId: number) {
  await requireAdmin();
  await updateHumanTaskStatus(taskId, "in_progress");
  revalidatePath("/admin/manager");
}

export async function reopenTaskAction(taskId: number) {
  await requireAdmin();
  await updateHumanTaskStatus(taskId, "open");
  revalidatePath("/admin/manager");
}

export async function completeTaskAction(taskId: number, notes?: string) {
  await requireAdmin();
  await updateHumanTaskStatus(taskId, "done", notes);
  revalidatePath("/admin/manager");
}

export async function rejectTaskAction(taskId: number, reason?: string) {
  await requireAdmin();
  await updateHumanTaskStatus(taskId, "rejected", reason);
  revalidatePath("/admin/manager");
}

export async function startSessionAction(opening?: string) {
  await requireAdmin();
  const result = await startManagerSession(
    JANICKA_PROJECT_ID,
    opening,
    "janicka-admin",
  );
  revalidatePath("/admin/manager");
  return result;
}
