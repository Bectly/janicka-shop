import { cookies } from "next/headers";

import { DRAFT_SESSION_COOKIE } from "@/lib/draft-qr";

export interface DraftSession {
  batchId: string;
  adminId: string;
}

export async function readDraftSession(): Promise<DraftSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(DRAFT_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [batchId, adminId] = raw.split(":");
  if (!batchId || !adminId) return null;
  return { batchId, adminId };
}

export async function requireDraftSessionForBatch(
  batchId: string
): Promise<DraftSession | null> {
  const session = await readDraftSession();
  if (!session) return null;
  if (session.batchId !== batchId) return null;
  return session;
}
