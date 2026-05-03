"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import {
  WorkspaceTabsStrip,
  type FixedTabKey,
} from "@/components/admin/manager/workspace-tabs-strip";
import { WorkspaceChat } from "@/components/admin/manager/workspace-chat";
import { NewWorkspaceModal } from "@/components/admin/manager/new-workspace-modal";
import {
  listWorkspaceTabsAction,
  type WorkspaceTabRow,
} from "@/app/(admin)/admin/manager/workspace/actions";

const REFRESH_INTERVAL_MS = 8000;

function subscribeHash(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

function readHashSnapshot(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace(/^#/, "");
}

function readHashServer(): string {
  return "";
}

function isFixedKey(key: string): key is FixedTabKey {
  return key === "dnes" || key === "historie";
}

function parseWorkspaceId(hash: string): string | null {
  if (!hash.startsWith("ws-")) return null;
  return hash.slice(3) || null;
}

export function WorkspaceTabsShell({
  fixedBadges,
  todayTab,
  historyTab,
  initialTabs,
}: {
  fixedBadges: { dnes: number; historie: number };
  todayTab: ReactNode;
  historyTab: ReactNode;
  initialTabs: WorkspaceTabRow[];
}) {
  const [tabs, setTabs] = useState<WorkspaceTabRow[]>(initialTabs);
  const [modalOpen, setModalOpen] = useState(false);

  const hash = useSyncExternalStore(
    subscribeHash,
    readHashSnapshot,
    readHashServer,
  );

  const wsId = parseWorkspaceId(hash);
  const fixed: FixedTabKey | null = isFixedKey(hash) ? hash : null;
  const activeKey = wsId
    ? `ws-${wsId}`
    : fixed
      ? fixed
      : "dnes";

  const setHash = useCallback((next: string) => {
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", `#${next}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);

  const refreshTabs = useCallback(async () => {
    const r = await listWorkspaceTabsAction();
    if (r.ok) setTabs(r.tabs);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void refreshTabs();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refreshTabs]);

  // If hash points at a workspace tab that no longer exists, fall back to Dnes.
  useEffect(() => {
    if (!wsId) return;
    if (tabs.length === 0) return;
    const exists = tabs.some((t) => t.id === wsId);
    if (!exists) setHash("dnes");
  }, [wsId, tabs, setHash]);

  const activeTab = wsId ? tabs.find((t) => t.id === wsId) ?? null : null;

  return (
    <div className="space-y-4">
      <WorkspaceTabsStrip
        fixedBadges={fixedBadges}
        tabs={tabs}
        activeKey={activeKey}
        onSelectFixed={(key) => setHash(key)}
        onSelectWorkspace={(id) => setHash(`ws-${id}`)}
        onOpenNew={() => setModalOpen(true)}
        onTabsChanged={refreshTabs}
      />

      <div role="tabpanel" id={`manager-panel-${activeKey}`} className="min-w-0">
        {activeKey === "dnes" && todayTab}
        {activeKey === "historie" && historyTab}
        {wsId && activeTab && (
          <WorkspaceChat
            key={activeTab.id}
            tabId={activeTab.id}
            tabTitle={activeTab.title}
            onMessageSent={refreshTabs}
          />
        )}
        {wsId && !activeTab && (
          <div className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            Konverzace nenalezena. Vyber jinou nebo vytvoř novou.
          </div>
        )}
      </div>

      <NewWorkspaceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={(id) => {
          void refreshTabs();
          setHash(`ws-${id}`);
        }}
      />
    </div>
  );
}
