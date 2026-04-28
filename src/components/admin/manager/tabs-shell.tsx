"use client";

import { type ReactNode, useCallback, useSyncExternalStore } from "react";
import { MessageSquare, ListTodo, BarChart3, Cog } from "lucide-react";
import { cn } from "@/lib/utils";

export type ManagerTabKey = "konverzace" | "ukoly" | "reporty" | "session";

const VALID_KEYS: ManagerTabKey[] = [
  "konverzace",
  "ukoly",
  "reporty",
  "session",
];

type TabDef = {
  key: ManagerTabKey;
  label: string;
  icon: typeof MessageSquare;
  badge?: number;
  hidden?: boolean;
};

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

export function ManagerTabsShell({
  tasksTab,
  reportsTab,
  sessionTab,
  conversationTab,
  badges,
  isAdmin,
}: {
  conversationTab: ReactNode;
  tasksTab: ReactNode;
  reportsTab: ReactNode;
  sessionTab: ReactNode;
  badges: { konverzace: number; ukoly: number; reporty: number };
  isAdmin: boolean;
}) {
  const hash = useSyncExternalStore(
    subscribeHash,
    readHashSnapshot,
    readHashServer,
  );
  const fromHash = VALID_KEYS.includes(hash as ManagerTabKey)
    ? (hash as ManagerTabKey)
    : null;
  const active: ManagerTabKey =
    fromHash && (isAdmin || fromHash !== "session") ? fromHash : "konverzace";

  const select = useCallback((key: ManagerTabKey) => {
    if (typeof window === "undefined") return;
    // replaceState avoids a history entry per click; dispatching the event
    // feeds back through useSyncExternalStore so URL stays the source of truth.
    window.history.replaceState(null, "", `#${key}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, []);

  const tabs: TabDef[] = [
    {
      key: "konverzace",
      label: "Konverzace",
      icon: MessageSquare,
      badge: badges.konverzace,
    },
    { key: "ukoly", label: "Úkoly", icon: ListTodo, badge: badges.ukoly },
    { key: "reporty", label: "Reporty", icon: BarChart3, badge: badges.reporty },
    { key: "session", label: "Session", icon: Cog, hidden: !isAdmin },
  ];

  const visibleTabs = tabs.filter((t) => !t.hidden);

  return (
    <div className="space-y-4">
      {/* Tab list — sticky below the admin header (h-14). Without top-14 the
          tab list slides under the header on scroll because both share top-0. */}
      <div className="sticky top-14 z-10 -mx-2 bg-background/95 px-2 pb-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:mx-0 md:px-0 md:pb-1 md:bg-background/85">
        <div
          role="tablist"
          aria-label="Manažerka — sekce"
          className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1 shadow-sm scrollbar-thin md:overflow-visible"
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.key;
            const isUnreadAccent =
              tab.key === "konverzace" &&
              typeof tab.badge === "number" &&
              tab.badge > 0;
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`manager-panel-${tab.key}`}
                onClick={() => select(tab.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                  "min-h-10 md:min-h-9",
                  isActive
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{tab.label}</span>
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span
                    className={cn(
                      "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : isUnreadAccent
                          ? "bg-pink-600 text-white"
                          : "bg-foreground/[0.08] text-foreground/70",
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`manager-panel-${active}`}
        className="min-w-0"
      >
        {active === "konverzace" && conversationTab}
        {active === "ukoly" && tasksTab}
        {active === "reporty" && reportsTab}
        {active === "session" && sessionTab}
      </div>
    </div>
  );
}
