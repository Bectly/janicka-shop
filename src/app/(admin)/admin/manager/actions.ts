"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  markDevloopTaskBlocked as jarvisMarkBlocked,
  markDevloopTaskCompleted as jarvisMarkCompleted,
} from "@/lib/jarvis-db";

const JANICKA_PROJECT_ID = 15;
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

async function requireAdmin(): Promise<{ email: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return { email: session.user.email ?? "shop-owner" };
}

export async function changeTaskStatusAction(
  taskId: string,
  newStatus: string,
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
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
  const { email } = await requireAdmin();
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
      acceptedBy: email,
    },
  });
  revalidatePath("/admin/manager");
  return { ok: true };
}

/**
 * Request a new manager session. The watcher daemon on bectly's machine
 * polls Turso for ManagerSession.status='requested' and spawns the runner.
 */
export async function requestSessionAction(
  openingMessage?: string,
  attachmentUrls?: string[],
): Promise<{ ok: boolean; error?: string; sessionId?: string }> {
  await requireAdmin();
  const prisma = await getDb();
  const existing = await prisma.managerSession.findFirst({
    where: {
      projectId: JANICKA_PROJECT_ID,
      status: { in: ["requested", "claimed", "running"] },
    },
  });
  if (existing) {
    return {
      ok: false,
      error: "Manažerka už běží (nebo je ve frontě). Počkej až dokončí.",
    };
  }
  const cleanAttachments = (attachmentUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^https:\/\//.test(u))
    .slice(0, 5);
  const session = await prisma.managerSession.create({
    data: {
      projectId: JANICKA_PROJECT_ID,
      status: "requested",
      triggeredBy: "janicka-admin",
      openingMessage: openingMessage?.trim() || null,
      attachmentUrls: cleanAttachments.length > 0 ? JSON.stringify(cleanAttachments) : null,
      requestedAt: new Date(),
    },
  });
  revalidatePath("/admin/manager");
  return { ok: true, sessionId: session.id };
}

/**
 * Upload an image attachment to R2 for use in the next manager session opening
 * message. Returns the public URL — the form keeps the URLs in local state and
 * passes them to requestSessionAction on submit.
 *
 * Limits: 5 MB per image, png/jpg/webp only. Folder `manager-uploads/`.
 */
export async function uploadManagerAttachmentAction(
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Žádný soubor" };
  const allowed = ["image/png", "image/jpeg", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: "Povoleny jen PNG/JPG/WEBP" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "Max 5 MB" };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const { uploadToR2 } = await import("@/lib/r2");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 60);
  const result = await uploadToR2(buffer, safeName, file.type, "manager-uploads");
  return { ok: true, url: result.url };
}

/**
 * Add a comment to a task / artifact / session.
 * Comments are visible to both the shop owner and the manager (next session
 * can read recent comments as feedback context).
 */
export async function addCommentAction(
  parentType: "task" | "artifact" | "session",
  parentId: string,
  bodyMd: string,
): Promise<{ ok: boolean; error?: string; commentId?: string }> {
  const { email } = await requireAdmin();
  const trimmed = bodyMd.trim();
  if (!trimmed) return { ok: false, error: "Prázdný komentář" };
  if (trimmed.length > 4000)
    return { ok: false, error: "Komentář je moc dlouhý (max 4000 znaků)" };
  if (!["task", "artifact", "session"].includes(parentType))
    return { ok: false, error: "Neplatný typ" };

  const prisma = await getDb();
  const data: {
    projectId: number;
    parentType: string;
    parentId: string;
    authorRole: string;
    authorName: string;
    bodyMd: string;
    taskId?: string;
    artifactId?: string;
    sessionId?: string;
  } = {
    projectId: JANICKA_PROJECT_ID,
    parentType,
    parentId,
    authorRole: "shop owner",
    authorName: email,
    bodyMd: trimmed,
  };
  if (parentType === "task") data.taskId = parentId;
  if (parentType === "artifact") data.artifactId = parentId;
  if (parentType === "session") data.sessionId = parentId;

  const c = await prisma.managerComment.create({ data });
  revalidatePath("/admin/manager");
  return { ok: true, commentId: c.id };
}

/**
 * Flip a devloop_task in JARVIS DB to `blocked`. Server-side enforces ownership
 * (Janička can only mutate tasks she or her promote pipeline created — Lead/Bolt
 * tasks stay read-only).
 */
export async function markDevloopTaskBlockedAction(
  id: number,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Neplatné ID" };
  }
  const result = await jarvisMarkBlocked(id, reason);
  if (result.ok) revalidatePath("/admin/manager");
  return result;
}

export async function markDevloopTaskCompletedAction(
  id: number,
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Neplatné ID" };
  }
  const result = await jarvisMarkCompleted(id, notes);
  if (result.ok) revalidatePath("/admin/manager");
  return result;
}
