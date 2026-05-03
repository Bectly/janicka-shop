"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Sparkles,
  Calendar,
  Plus,
  Pin,
  Archive as ArchiveIcon,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  WorkspaceTabContextMenu,
  type WorkspaceTabAction,
} from "@/components/admin/manager/workspace-tab-context-menu";
import {
  archiveWorkspaceTabAction,
  deleteWorkspaceTabAction,
  pinWorkspaceTabAction,
  unarchiveWorkspaceTabAction,
  unpinWorkspaceTabAction,
  type WorkspaceTabRow,
} from "@/app/(admin)/admin/manager/workspace/actions";

const FIXED_VISIBLE_LIMIT = 8;

export type FixedTabKey = "dnes" | "historie";

type FixedTabDef = {
  key: FixedTabKey;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

export function WorkspaceTabsStrip({
  fixedBadges,
  tabs,
  activeKey,
  onSelectFixed,
  onSelectWorkspace,
  onOpenNew,
  onTabsChanged,
}: {
  fixedBadges: { dnes: number; historie: number };
  tabs: WorkspaceTabRow[];
  activeKey: string; // "dnes" | "historie" | "ws-<tabId>"
  onSelectFixed: (key: FixedTabKey) => void;
  onSelectWorkspace: (tabId: string) => void;
  onOpenNew: () => void;
  onTabsChanged: () => void;
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
    status: "active" | "pinned" | "archived";
  } | null>(null);
  const [, startMutation] = useTransition();
  const archiveBtnRef = useRef<HTMLButtonElement | null>(null);
  const overflowBtnRef = useRef<HTMLButtonElement | null>(null);

  const pinned = tabs.filter((t) => t.status === "pinned");
  const active = tabs.filter((t) => t.status === "active");
  const archived = tabs.filter((t) => t.status === "archived");

  // Pinned first, then active by recency. Cap visible at FIXED_VISIBLE_LIMIT —
  // remainder spills into overflow dropdown so the strip stays scannable.
  const live = [...pinned, ...active];
  const visible = live.slice(0, FIXED_VISIBLE_LIMIT);
  const overflow = live.slice(FIXED_VISIBLE_LIMIT);

  // Derived open flags — guard against stale "open" when the underlying list
  // becomes empty (e.g. after the last archived tab is restored).
  const showOverflowMenu = overflowOpen && overflow.length > 0;
  const showArchiveMenu = archiveOpen && archived.length > 0;

  const fixedTabs: FixedTabDef[] = [
    { key: "dnes", label: "Dnes", icon: Sparkles, badge: fixedBadges.dnes },
    {
      key: "historie",
      label: "Historie",
      icon: Calendar,
      badge: fixedBadges.historie,
    },
  ];

  const handleContextMenu = (
    e: ReactMouseEvent<HTMLButtonElement>,
    tab: WorkspaceTabRow,
  ) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id, status: tab.status });
  };

  const handleAction = (tabId: string, action: WorkspaceTabAction) => {
    startMutation(async () => {
      const before = tabs.find((t) => t.id === tabId);
      const wasActive = activeKey === `ws-${tabId}`;
      let result;
      switch (action) {
        case "pin":
          result = await pinWorkspaceTabAction(tabId);
          break;
        case "unpin":
          result = await unpinWorkspaceTabAction(tabId);
          break;
        case "archive":
          result = await archiveWorkspaceTabAction(tabId);
          break;
        case "unarchive":
          result = await unarchiveWorkspaceTabAction(tabId);
          break;
        case "delete":
          if (
            !window.confirm(
              `Smazat konverzaci „${before?.title ?? "tuto"}“? Akci nelze vrátit.`,
            )
          )
            return;
          result = await deleteWorkspaceTabAction(tabId);
          break;
      }
      if (!result?.ok) {
        window.alert(result?.error ?? "Akce selhala");
        return;
      }
      onTabsChanged();
      // If the active tab was deleted/archived, fall back to "Dnes".
      if (wasActive && (action === "delete" || action === "archive")) {
        onSelectFixed("dnes");
      }
    });
  };

  return (
    <div className="sticky top-14 z-10 -mx-2 bg-background/95 px-2 pb-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:mx-0 md:px-0 md:pb-1 md:bg-background/85">
      <div
        role="tablist"
        aria-label="Manažerka — sekce a workspace konverzace"
        className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1 shadow-sm md:flex-nowrap md:overflow-x-auto md:scrollbar-thin"
      >
        {/* Fixed tabs (Dnes / Historie) */}
        {fixedTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeKey === tab.key;
          return (
            <TabButton
              key={tab.key}
              isActive={isActive}
              icon={Icon}
              label={tab.label}
              badge={tab.badge}
              onClick={() => onSelectFixed(tab.key)}
            />
          );
        })}

        {/* Separator between fixed and dynamic tabs */}
        {(visible.length > 0 || overflow.length > 0) && (
          <span
            aria-hidden="true"
            className="mx-1 hidden h-6 w-px shrink-0 bg-border md:inline-block"
          />
        )}

        {/* Dynamic workspace tabs */}
        {visible.map((tab) => {
          const isActive = activeKey === `ws-${tab.id}`;
          return (
            <WorkspaceTabButton
              key={tab.id}
              tab={tab}
              isActive={isActive}
              onClick={() => onSelectWorkspace(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab)}
            />
          );
        })}

        {/* Overflow dropdown for tabs >8 */}
        {overflow.length > 0 && (
          <div className="relative">
            <button
              ref={overflowBtnRef}
              type="button"
              onClick={() => setOverflowOpen((v) => !v)}
              aria-expanded={overflowOpen}
              aria-label={`Další konverzace (${overflow.length})`}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              +{overflow.length}
              <ChevronDown className="size-3.5" />
            </button>
            {showOverflowMenu && (
              <OverflowMenu
                tabs={overflow}
                onSelect={(id) => {
                  onSelectWorkspace(id);
                  setOverflowOpen(false);
                }}
                onClose={() => setOverflowOpen(false)}
                anchor={overflowBtnRef}
                emptyLabel="Žádné další"
                icon={Pin}
              />
            )}
          </div>
        )}

        {/* + Nový button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenNew}
          className="ml-auto inline-flex shrink-0 items-center gap-1 text-pink-600 hover:bg-pink-500/10 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300"
        >
          <Plus className="size-4" />
          Nový
        </Button>

        {/* Archive dropdown — only when archived tabs exist */}
        {archived.length > 0 && (
          <div className="relative">
            <button
              ref={archiveBtnRef}
              type="button"
              onClick={() => setArchiveOpen((v) => !v)}
              aria-expanded={archiveOpen}
              aria-label={`Archiv (${archived.length})`}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              <ArchiveIcon className="size-4" />
              <span className="hidden sm:inline">Archiv</span>
              <span className="rounded-full bg-foreground/[0.08] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-foreground/70">
                {archived.length}
              </span>
            </button>
            {showArchiveMenu && (
              <OverflowMenu
                tabs={archived}
                onSelect={(id) => {
                  onSelectWorkspace(id);
                  setArchiveOpen(false);
                }}
                onClose={() => setArchiveOpen(false)}
                anchor={archiveBtnRef}
                emptyLabel="Archiv prázdný"
                icon={ArchiveIcon}
                align="right"
              />
            )}
          </div>
        )}
      </div>

      {contextMenu && (
        <WorkspaceTabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          status={contextMenu.status}
          onClose={() => setContextMenu(null)}
          onSelect={(action) => handleAction(contextMenu.tabId, action)}
        />
      )}
    </div>
  );
}

function TabButton({
  isActive,
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  isActive: boolean;
  icon: LucideIcon;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
        "min-h-10 md:min-h-9",
        isActive
          ? "bg-primary text-primary-foreground shadow"
          : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span
          className={cn(
            "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
            isActive
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-foreground/[0.08] text-foreground/70",
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function WorkspaceTabButton({
  tab,
  isActive,
  onClick,
  onContextMenu,
}: {
  tab: WorkspaceTabRow;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`${tab.title}${tab.unreadCount > 0 ? ` — ${tab.unreadCount} nová odpověď` : ""} (pravý klik pro akce)`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap",
        "min-h-10 md:min-h-9 max-w-[200px]",
        isActive
          ? "bg-primary text-primary-foreground shadow font-medium"
          : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      {tab.status === "pinned" && (
        <Pin className="size-3 shrink-0" aria-label="Připnuto" />
      )}
      <span className="truncate">{tab.title}</span>
      {tab.unreadCount > 0 && !isActive && (
        <span
          aria-label={`${tab.unreadCount} nová zpráva`}
          className="ml-0.5 rounded-full bg-pink-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white"
        >
          {tab.unreadCount}
        </span>
      )}
    </button>
  );
}

function OverflowMenu({
  tabs,
  onSelect,
  onClose,
  anchor,
  emptyLabel,
  icon: Icon,
  align = "left",
}: {
  tabs: WorkspaceTabRow[];
  onSelect: (id: string) => void;
  onClose: () => void;
  anchor: React.RefObject<HTMLButtonElement | null>;
  emptyLabel: string;
  icon: LucideIcon;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchor.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, anchor]);

  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        "absolute top-full mt-1 z-20 min-w-[220px] max-w-[320px] rounded-md border bg-popover p-1 shadow-lg",
        align === "right" ? "right-0" : "left-0",
      )}
    >
      {tabs.length === 0 ? (
        <p className="px-2 py-1.5 text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="menuitem"
            onClick={() => onSelect(t.id)}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-foreground/[0.06]"
          >
            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{t.title}</span>
            {t.unreadCount > 0 && (
              <span className="ml-auto rounded-full bg-pink-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {t.unreadCount}
              </span>
            )}
          </button>
        ))
      )}
    </div>
  );
}
