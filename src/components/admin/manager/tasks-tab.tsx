"use client";

import { useState } from "react";
import { Bot, ChevronDown, AlertTriangle } from "lucide-react";
import { TaskCard } from "@/components/admin/manager/task-card";
import {
  DevloopTaskCard,
  type DevloopTaskCardProps,
} from "@/components/admin/manager/devloop-task-card";
import { cn } from "@/lib/utils";

type ManagerTaskRow = {
  id: string;
  category: string;
  priority: string;
  assigneeHint: string | null;
  title: string;
  descriptionMd: string;
  rationaleMd: string | null;
  expectedOutcome: string | null;
  dueAt: Date | null;
  status: string;
  createdAt: Date;
  comments?: Array<{
    id: string;
    authorRole: string;
    authorName: string | null;
    bodyMd: string;
    createdAt: Date | string;
  }>;
};

export function TasksTab({
  openTasks,
  inFlightTasks,
  recentDone,
  blockedTasks,
  devloopOpen,
  devloopBlocked,
  hideTechnicalTags = true,
}: {
  openTasks: ManagerTaskRow[];
  inFlightTasks: ManagerTaskRow[];
  recentDone: ManagerTaskRow[];
  blockedTasks: ManagerTaskRow[];
  devloopOpen: DevloopTaskCardProps["task"][];
  devloopBlocked: DevloopTaskCardProps["task"][];
  hideTechnicalTags?: boolean;
}) {
  const [devloopOpenSection, setDevloopOpenSection] = useState(false);
  const totalActive =
    openTasks.length + inFlightTasks.length + blockedTasks.length;
  const totalDevloop = devloopOpen.length + devloopBlocked.length;

  const sanitizeDevloop = (t: DevloopTaskCardProps["task"]) =>
    hideTechnicalTags
      ? { ...t, tag: "AI", description: null }
      : t;

  return (
    <div className="space-y-6">
      {/* Manager-issued tasks (kanban) */}
      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-lg sm:text-xl font-semibold">
            Tvoje úkoly od manažerky
          </h2>
          <p className="text-xs text-muted-foreground">
            {totalActive > 0
              ? `${totalActive} aktivních${recentDone.length > 0 ? ` · ${recentDone.length} dokončených (7d)` : ""}`
              : "Žádné aktivní úkoly"}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <KanbanColumn
            title="Otevřené"
            count={openTasks.length}
            tasks={openTasks}
            empty="Žádné otevřené úkoly"
          />
          <KanbanColumn
            title="V práci"
            count={inFlightTasks.length}
            tasks={inFlightTasks}
            empty="Nic se právě nedělá"
          />
          <KanbanColumn
            title="Hotové · 7d"
            count={recentDone.length}
            tasks={recentDone}
            empty="Tento týden nic dokončené"
          />
        </div>
      </section>

      {/* Blocked tasks — separate, visible but distinct */}
      {blockedTasks.length > 0 && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <h3 className="flex items-center gap-2 font-medium text-sm text-amber-700">
            <AlertTriangle className="size-4" />
            Blokované úkoly · {blockedTasks.length}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {blockedTasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </section>
      )}

      {/* Devloop tasks — collapsible accordion, default closed */}
      <section
        className={cn(
          "rounded-lg border bg-card shadow-sm transition-shadow",
          devloopOpenSection && "shadow",
        )}
      >
        <button
          type="button"
          onClick={() => setDevloopOpenSection((v) => !v)}
          aria-expanded={devloopOpenSection}
          aria-controls="devloop-section"
          className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left hover:bg-foreground/[0.03]"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <Bot className="size-5 shrink-0 text-primary mt-0.5" />
            <div className="min-w-0">
              <div className="font-medium text-sm">
                Co dělají AI agenti? · {totalDevloop} {totalDevloop === 1 ? "aktivní" : "aktivních"}
              </div>
              <p className="text-xs text-muted-foreground">
                Detaily co řeší vývoj v pozadí. Klikni pro zobrazení.
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              devloopOpenSection && "rotate-180",
            )}
          />
        </button>

        {devloopOpenSection && (
          <div id="devloop-section" className="border-t px-4 py-3 space-y-3">
            {totalDevloop === 0 ? (
              <p className="rounded-md border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">
                Žádné aktivní úkoly v pozadí.
              </p>
            ) : (
              <>
                {devloopOpen.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {devloopOpen.map((t) => (
                      <DevloopTaskCard key={t.id} task={sanitizeDevloop(t)} />
                    ))}
                  </div>
                )}
                {devloopBlocked.length > 0 && (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <h4 className="font-medium text-xs text-amber-700">
                      Blokováno · {devloopBlocked.length}
                    </h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      {devloopBlocked.map((t) => (
                        <DevloopTaskCard
                          key={t.id}
                          task={sanitizeDevloop(t)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function KanbanColumn({
  title,
  count,
  tasks,
  empty,
}: {
  title: string;
  count: number;
  tasks: ManagerTaskRow[];
  empty: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-foreground">{title}</h3>
        <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="rounded-md border border-dashed bg-card/30 p-4 text-center text-xs text-muted-foreground">
            {empty}
          </p>
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={t} />)
        )}
      </div>
    </div>
  );
}
