"use client";

import { useQuery } from "@tanstack/react-query";

export type LiveState = {
  ts: string;
  mailbox: {
    unreadCount: number;
    latestThreadAt: string | null;
    totalThreads: number;
  };
  workspace: {
    tabs: Array<{
      tabId: string;
      title: string;
      lastActivityAt: string;
      unreadMessages: number;
    }>;
    totalActive: number;
  };
  manager: {
    unreadThreadCount: number;
    latestReplyAt: string | null;
  };
  orders: {
    paidNotShippedCount: number;
    newSince5MinCount: number;
    latestOrderAt: string | null;
  };
  drafts: {
    activeBatchCount: number;
    mostRecentBatchProgress:
      | { batchId: string; percent: number }
      | null;
  };
};

async function fetchLiveState(): Promise<LiveState> {
  const res = await fetch("/api/admin/live-state", { cache: "no-store" });
  if (!res.ok) throw new Error(`live-state ${res.status}`);
  return res.json();
}

function pollInterval(): number | false {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "visible" ? 15_000 : 60_000;
}

export function useLiveState() {
  return useQuery({
    queryKey: ["live-state"],
    queryFn: fetchLiveState,
    refetchInterval: pollInterval,
    refetchIntervalInBackground: true,
  });
}
