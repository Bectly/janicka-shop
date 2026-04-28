"use client";

import { type ReactNode, useState } from "react";
import { MessageSquare, ListTodo, BarChart3, Cog } from "lucide-react";
import { cn } from "@/lib/utils";

export type ManagerTabKey = "konverzace" | "ukoly" | "reporty" | "session";

type TabDef = {
  key: ManagerTabKey;
  label: string;
  icon: typeof MessageSquare;
  badge?: number;
  hidden?: boolean;
};

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
  badges: { ukoly: number; reporty: number };
  isAdmin: boolean;
}) {
  const [active, setActive] = useState<ManagerTabKey>("ukoly");

  const tabs: TabDef[] = [
    { key: "konverzace", label: "Konverzace", icon: MessageSquare },
    { key: "ukoly", label: "Úkoly", icon: ListTodo, badge: badges.ukoly },
    { key: "reporty", label: "Reporty", icon: BarChart3, badge: badges.reporty },
    { key: "session", label: "Session", icon: Cog, hidden: !isAdmin },
  ];

  const visibleTabs = tabs.filter((t) => !t.hidden);

  return (
    <div className="space-y-4">
      {/* Tab list — horizontally scrollable on mobile, normal on md+ */}
      <div className="sticky top-0 z-10 -mx-2 bg-background/95 px-2 pb-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:static md:mx-0 md:px-0 md:pb-0 md:bg-transparent">
        <div
          role="tablist"
          aria-label="Manažerka — sekce"
          className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1 shadow-sm scrollbar-thin md:overflow-visible"
        >
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls={`manager-panel-${tab.key}`}
                onClick={() => setActive(tab.key)}
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
