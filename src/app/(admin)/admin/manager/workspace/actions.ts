"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const JANICKA_PROJECT_ID = 15;
const TITLE_MAX = 120;
const MESSAGE_MAX = 8000;
const ATTACHMENT_MAX = 5;

async function requireAdmin(): Promise<{ email: string }> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    throw new Error("Unauthorized");
  }
  return { email: session.user.email ?? "shop-owner" };
}

export type WorkspaceTabRow = {
  id: string;
  title: string;
  status: "active" | "pinned" | "archived";
  createdAt: string;
  lastActivityAt: string;
  unreadCount: number;
  lastSeenAt: string | null;
};

export type WorkspaceMessageRow = {
  id: string;
  role: "user" | "manager" | "system";
  contentMd: string;
  attachments: string[];
  createdAt: string;
  processedAt: string | null;
};

function tabStatus(s: string): "active" | "pinned" | "archived" {
  if (s === "pinned" || s === "archived") return s;
  return "active";
}

function messageRole(r: string): "user" | "manager" | "system" {
  if (r === "manager" || r === "system") return r;
  return "user";
}

function safeAttachments(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u): u is string => typeof u === "string")
    .filter((u) => /^https:\/\//.test(u))
    .slice(0, ATTACHMENT_MAX);
}

function readLastSeen(settingsJson: unknown): string | null {
  if (!settingsJson || typeof settingsJson !== "object") return null;
  const v = (settingsJson as Record<string, unknown>).lastSeenAt;
  return typeof v === "string" ? v : null;
}

export async function listWorkspaceTabsAction(): Promise<{
  ok: true;
  tabs: WorkspaceTabRow[];
}> {
  await requireAdmin();
  const prisma = await getDb();
  const tabs = await prisma.managerWorkspaceTab.findMany({
    where: { projectId: JANICKA_PROJECT_ID },
    orderBy: [{ status: "asc" }, { lastActivityAt: "desc" }],
    take: 200,
  });

  const rows: WorkspaceTabRow[] = await Promise.all(
    tabs.map(async (t) => {
      const lastSeen = readLastSeen(t.settingsJson);
      const unreadCount = await prisma.workspaceMessage.count({
        where: {
          tabId: t.id,
          role: "manager",
          createdAt: lastSeen ? { gt: new Date(lastSeen) } : undefined,
        },
      });
      return {
        id: t.id,
        title: t.title,
        status: tabStatus(t.status),
        createdAt: t.createdAt.toISOString(),
        lastActivityAt: t.lastActivityAt.toISOString(),
        unreadCount,
        lastSeenAt: lastSeen,
      };
    }),
  );

  return { ok: true, tabs: rows };
}

export async function createWorkspaceTabAction(
  title: string,
): Promise<{ ok: boolean; error?: string; tab?: WorkspaceTabRow }> {
  const { email } = await requireAdmin();
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Zadej název konverzace" };
  if (trimmed.length > TITLE_MAX)
    return { ok: false, error: `Max ${TITLE_MAX} znaků` };

  const prisma = await getDb();
  const created = await prisma.managerWorkspaceTab.create({
    data: {
      projectId: JANICKA_PROJECT_ID,
      title: trimmed,
      status: "active",
      createdBy: email,
    },
  });
  revalidatePath("/admin/manager");
  return {
    ok: true,
    tab: {
      id: created.id,
      title: created.title,
      status: tabStatus(created.status),
      createdAt: created.createdAt.toISOString(),
      lastActivityAt: created.lastActivityAt.toISOString(),
      unreadCount: 0,
      lastSeenAt: null,
    },
  };
}

async function setTabStatus(
  tabId: string,
  status: "active" | "pinned" | "archived",
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const prisma = await getDb();
  const tab = await prisma.managerWorkspaceTab.findUnique({
    where: { id: tabId },
  });
  if (!tab || tab.projectId !== JANICKA_PROJECT_ID) {
    return { ok: false, error: "Tab nenalezen" };
  }
  await prisma.managerWorkspaceTab.update({
    where: { id: tabId },
    data: { status },
  });
  revalidatePath("/admin/manager");
  return { ok: true };
}

export async function pinWorkspaceTabAction(tabId: string) {
  return setTabStatus(tabId, "pinned");
}

export async function unpinWorkspaceTabAction(tabId: string) {
  return setTabStatus(tabId, "active");
}

export async function archiveWorkspaceTabAction(tabId: string) {
  return setTabStatus(tabId, "archived");
}

export async function unarchiveWorkspaceTabAction(tabId: string) {
  return setTabStatus(tabId, "active");
}

export async function deleteWorkspaceTabAction(
  tabId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const prisma = await getDb();
  const tab = await prisma.managerWorkspaceTab.findUnique({
    where: { id: tabId },
  });
  if (!tab || tab.projectId !== JANICKA_PROJECT_ID) {
    return { ok: false, error: "Tab nenalezen" };
  }
  await prisma.managerWorkspaceTab.delete({ where: { id: tabId } });
  revalidatePath("/admin/manager");
  return { ok: true };
}

export async function sendUserMessageAction(
  tabId: string,
  contentMd: string,
  attachmentUrls: string[] = [],
): Promise<{ ok: boolean; error?: string; message?: WorkspaceMessageRow }> {
  await requireAdmin();
  const trimmed = contentMd.trim();
  if (!trimmed) return { ok: false, error: "Prázdná zpráva" };
  if (trimmed.length > MESSAGE_MAX)
    return { ok: false, error: `Max ${MESSAGE_MAX} znaků` };

  const prisma = await getDb();
  const tab = await prisma.managerWorkspaceTab.findUnique({
    where: { id: tabId },
  });
  if (!tab || tab.projectId !== JANICKA_PROJECT_ID) {
    return { ok: false, error: "Tab nenalezen" };
  }

  const cleanAttachments = safeAttachments(attachmentUrls);
  const now = new Date();
  const created = await prisma.workspaceMessage.create({
    data: {
      tabId,
      role: "user",
      contentMd: trimmed,
      attachmentJson: cleanAttachments,
    },
  });
  await prisma.managerWorkspaceTab.update({
    where: { id: tabId },
    data: {
      lastActivityAt: now,
      status: tab.status === "archived" ? "active" : tab.status,
    },
  });
  revalidatePath("/admin/manager");
  return {
    ok: true,
    message: {
      id: created.id,
      role: "user",
      contentMd: created.contentMd,
      attachments: cleanAttachments,
      createdAt: created.createdAt.toISOString(),
      processedAt: null,
    },
  };
}

export async function getWorkspaceMessagesAction(
  tabId: string,
  limit = 200,
): Promise<{
  ok: boolean;
  error?: string;
  messages?: WorkspaceMessageRow[];
}> {
  await requireAdmin();
  const prisma = await getDb();
  const tab = await prisma.managerWorkspaceTab.findUnique({
    where: { id: tabId },
  });
  if (!tab || tab.projectId !== JANICKA_PROJECT_ID) {
    return { ok: false, error: "Tab nenalezen" };
  }
  const rows = await prisma.workspaceMessage.findMany({
    where: { tabId },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(limit, 1), 500),
  });
  const messages = rows.map((r) => ({
    id: r.id,
    role: messageRole(r.role),
    contentMd: r.contentMd,
    attachments: safeAttachments(r.attachmentJson),
    createdAt: r.createdAt.toISOString(),
    processedAt: r.processedAt ? r.processedAt.toISOString() : null,
  }));
  return { ok: true, messages };
}

export async function pollNewMessagesAction(
  tabId: string,
  sinceIso: string,
): Promise<{
  ok: boolean;
  error?: string;
  messages?: WorkspaceMessageRow[];
  serverNow?: string;
}> {
  await requireAdmin();
  const prisma = await getDb();
  const tab = await prisma.managerWorkspaceTab.findUnique({
    where: { id: tabId },
  });
  if (!tab || tab.projectId !== JANICKA_PROJECT_ID) {
    return { ok: false, error: "Tab nenalezen" };
  }
  const since = new Date(sinceIso);
  if (Number.isNaN(since.getTime())) {
    return { ok: false, error: "Neplatné since" };
  }
  const rows = await prisma.workspaceMessage.findMany({
    where: { tabId, createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const messages = rows.map((r) => ({
    id: r.id,
    role: messageRole(r.role),
    contentMd: r.contentMd,
    attachments: safeAttachments(r.attachmentJson),
    createdAt: r.createdAt.toISOString(),
    processedAt: r.processedAt ? r.processedAt.toISOString() : null,
  }));
  return { ok: true, messages, serverNow: new Date().toISOString() };
}

export async function markTabSeenAction(
  tabId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const prisma = await getDb();
  const tab = await prisma.managerWorkspaceTab.findUnique({
    where: { id: tabId },
  });
  if (!tab || tab.projectId !== JANICKA_PROJECT_ID) {
    return { ok: false, error: "Tab nenalezen" };
  }
  const settings =
    tab.settingsJson && typeof tab.settingsJson === "object"
      ? (tab.settingsJson as Record<string, unknown>)
      : {};
  const next = { ...settings, lastSeenAt: new Date().toISOString() };
  await prisma.managerWorkspaceTab.update({
    where: { id: tabId },
    data: { settingsJson: next },
  });
  return { ok: true };
}
