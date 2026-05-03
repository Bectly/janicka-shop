import { Archive, AlertTriangle, FileWarning, Trash2 } from "lucide-react";
import {
  archiveWorkspaceTabAction,
  forceCleanupWorkspaceTabAction,
  getWorkspaceObservabilityAction,
  type WorkspaceQuotaPoint,
  type WorkspaceTabUsageRow,
} from "@/app/(admin)/admin/manager/workspace/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<WorkspaceTabUsageRow["status"], string> = {
  active: "Aktivní",
  pinned: "Připnuto",
  archived: "Archiv",
};

const FS_OP_LABEL: Record<string, string> = {
  read: "čtení",
  write: "zápis",
  delete: "smazání",
  exec: "spuštění",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("cs-CZ", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("cs-CZ", {
      day: "numeric",
      month: "numeric",
    });
  } catch {
    return iso;
  }
}

async function archiveTab(formData: FormData) {
  "use server";
  const id = String(formData.get("tabId") ?? "");
  if (!id) return;
  await archiveWorkspaceTabAction(id);
}

async function cleanupTab(formData: FormData) {
  "use server";
  const id = String(formData.get("tabId") ?? "");
  if (!id) return;
  await forceCleanupWorkspaceTabAction(id);
}

function Sparkline({ points }: { points: WorkspaceQuotaPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.fsOps));
  return (
    <div className="flex items-end gap-1 h-16" aria-label="Workspace aktivita za 7 dní">
      {points.map((p) => {
        const ratio = p.fsOps / max;
        const blockedRatio = p.fsOps === 0 ? 0 : p.blocked / p.fsOps;
        const heightPct = Math.max(4, Math.round(ratio * 100));
        return (
          <div
            key={p.date}
            className="flex flex-col items-center gap-1 flex-1 min-w-[18px]"
            title={`${formatDateShort(p.date)}: ${p.fsOps} ops${p.blocked ? `, ${p.blocked} zablokovaných` : ""}`}
          >
            <div className="relative w-full flex-1 flex items-end">
              <div
                className={cn(
                  "w-full rounded-t",
                  p.blocked > 0 ? "bg-amber-400" : "bg-primary/70",
                )}
                style={{ height: `${heightPct}%` }}
              >
                {blockedRatio > 0 ? (
                  <div
                    className="w-full rounded-t bg-red-500"
                    style={{ height: `${Math.round(blockedRatio * 100)}%` }}
                  />
                ) : null}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {formatDateShort(p.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }: { status: WorkspaceTabUsageRow["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        status === "pinned" && "bg-blue-50 text-blue-700",
        status === "active" && "bg-emerald-50 text-emerald-700",
        status === "archived" && "bg-muted text-muted-foreground",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export async function WorkspaceSection() {
  let data: Awaited<ReturnType<typeof getWorkspaceObservabilityAction>>;
  try {
    data = await getWorkspaceObservabilityAction();
  } catch {
    return null;
  }
  const { rows, sparkline, totals } = data;

  return (
    <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Manažerka — workspace
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Přehled využití AI workspace záložek, audit log a kvóty za posledních
            7 dní.
          </p>
        </div>
        <div className="mt-2 sm:mt-0 grid grid-cols-3 gap-3 text-right text-xs">
          <div>
            <div className="text-muted-foreground">Záložek</div>
            <div className="font-semibold text-foreground tabular-nums">
              {totals.tabs}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Velikost</div>
            <div className="font-semibold text-foreground tabular-nums">
              {formatBytes(totals.sizeBytes)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Blokováno</div>
            <div
              className={cn(
                "font-semibold tabular-nums",
                totals.blocked > 0 ? "text-amber-700" : "text-foreground",
              )}
            >
              {totals.blocked}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border bg-muted/30 p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            FS operace · 7 dní
          </span>
          <span className="text-xs text-muted-foreground">
            celkem {totals.fsOps} ops
          </span>
        </div>
        <Sparkline points={sparkline} />
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Žádné workspace záložky zatím neexistují.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Záložka</TableHead>
                <TableHead className="text-right">Velikost</TableHead>
                <TableHead className="text-right">Aktivita</TableHead>
                <TableHead className="text-right">Ops</TableHead>
                <TableHead className="text-right">Blokováno</TableHead>
                <TableHead className="text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="align-top">
                  <TableCell className="max-w-[260px]">
                    <details className="group">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium truncate">
                            {row.title}
                          </span>
                          <StatusBadge status={row.status} />
                        </div>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground group-open:hidden">
                          Klikni pro audit log ({row.recentFsOps.length})
                        </span>
                      </summary>
                      <div className="mt-3 rounded-md border bg-muted/30 p-3">
                        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Posledních {row.recentFsOps.length} fs operací
                        </div>
                        {row.recentFsOps.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Žádné operace.
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {row.recentFsOps.map((op) => {
                              const blocked =
                                op.exitCode !== 0 && op.exitCode !== null;
                              return (
                                <li
                                  key={op.id}
                                  className="flex items-start gap-2 text-xs"
                                >
                                  {blocked ? (
                                    <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                                  ) : (
                                    <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                  )}
                                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums shrink-0">
                                    {formatDateTime(op.ts)}
                                  </span>
                                  <span className="font-medium text-foreground shrink-0">
                                    {FS_OP_LABEL[op.opType] ?? op.opType}
                                  </span>
                                  <span
                                    className="font-mono text-[11px] text-muted-foreground truncate"
                                    title={op.path}
                                  >
                                    {op.path}
                                  </span>
                                  {op.bytes !== null ? (
                                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
                                      {formatBytes(op.bytes)}
                                    </span>
                                  ) : null}
                                  {blocked ? (
                                    <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                                      exit {op.exitCode ?? "?"}
                                    </span>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </details>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatBytes(row.sizeBytes)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(row.lastActivityAt)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.fsOpCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.blockedAttempts > 0 ? (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {row.blockedAttempts}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {row.status !== "archived" ? (
                        <form action={archiveTab}>
                          <input type="hidden" name="tabId" value={row.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                          >
                            <Archive className="mr-1 h-3 w-3" />
                            Archivovat
                          </Button>
                        </form>
                      ) : null}
                      <form action={cleanupTab}>
                        <input type="hidden" name="tabId" value={row.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          title="Smaže fs operace a systémové zprávy starší než 30 dní"
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Vyčistit
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Vyčistit smaže audit log fs operací a systémové zprávy starší než 30 dní
        (uživatelské zprávy a artefakty zůstávají).
      </p>
    </div>
  );
}
