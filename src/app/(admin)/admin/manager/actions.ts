"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ["accepted", "rejected"],
  accepted: ["in_progress", "rejected", "blocked"],
  in_progress: ["done", "blocked", "rejected"],
  blocked: ["accepted", "in_progress", "rejected"],
  done: [],
  rejected: [],
  stale: ["accepted"],
};

function canTransition(current: string, next: string): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export async function changeTaskStatusAction(
  taskId: string,
  newStatus: string,
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const prisma = await getDb();
  const task = await prisma.managerTask.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false, error: "Task nenalezen" };
  if (!canTransition(task.status, newStatus)) {
    return {
      ok: false,
      error: `Nelze přejít z '${task.status}' na '${newStatus}'`,
    };
  }
  const now = new Date();
  await prisma.managerTask.update({
    where: { id: taskId },
    data: {
      status: newStatus,
      acceptedAt:
        newStatus === "accepted" && !task.acceptedAt ? now : task.acceptedAt,
      startedAt:
        newStatus === "in_progress" && !task.startedAt ? now : task.startedAt,
      completedAt: newStatus === "done" ? now : task.completedAt,
      completionNotes: notes ?? task.completionNotes,
    },
  });
  revalidatePath("/admin/manager");
  return { ok: true };
}

export async function changeArtifactStatusAction(
  artifactId: string,
  newStatus: string,
): Promise<{ ok: boolean; error?: string }> {
  const allowed = ["accepted", "rejected", "merged", "done"];
  if (!allowed.includes(newStatus)) {
    return { ok: false, error: "Neplatný status" };
  }
  const prisma = await getDb();
  await prisma.managerArtifact.update({
    where: { id: artifactId },
    data: {
      status: newStatus,
      acceptedAt: newStatus === "accepted" ? new Date() : undefined,
      acceptedBy: "shop-owner",
    },
  });
  revalidatePath("/admin/manager");
  return { ok: true };
}
