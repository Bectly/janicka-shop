"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type LiveState = {
  ts: string;
  mailbox: {
    unreadCount: number;
    latestThreadAt: string | null;
    totalThreads: number;
    latestUnread: {
      threadId: string;
      subject: string;
      sender: string;
    } | null;
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
    latestOrder: {
      id: string;
      orderNumber: string;
      total: number;
      customerName: string;
    } | null;
  };
  drafts: {
    activeBatchCount: number;
    mostRecentBatchProgress:
      | { batchId: string; percent: number }
      | null;
  };
};

const POLL_MS = 30_000;

async function fetchLiveState(): Promise<LiveState> {
  const res = await fetch("/api/admin/live-state", { cache: "no-store" });
  if (!res.ok) throw new Error(`live-state ${res.status}`);
  return res.json();
}

// Page Visibility-aware polling. While the tab is hidden the interval is
// suppressed (refetchInterval=false) so we don't burn server resources on
// dashboards that nobody is looking at; on visibilitychange we trigger one
// immediate refetch and the next interval resumes automatically.
export function useLiveState() {
  const qc = useQueryClient();

  useEffect(() => {
    const onVisible = () => {
      if (typeof document === "undefined") return;
      if (!document.hidden) {
        qc.invalidateQueries({ queryKey: ["live-state"] });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [qc]);

  return useQuery({
    queryKey: ["live-state"],
    queryFn: fetchLiveState,
    refetchInterval: () => {
      if (typeof document === "undefined") return false;
      return document.hidden ? false : POLL_MS;
    },
    refetchIntervalInBackground: false,
  });
}
