"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBundleStatus } from "./actions";

const NEXT_STATUS: Record<string, string> = {
  ordered: "received",
  received: "unpacked",
  unpacked: "done",
};

const NEXT_LABEL: Record<string, string> = {
  ordered: "Označit jako přijato",
  received: "Označit jako rozbaleno",
  unpacked: "Označit jako hotovo",
};

interface Props {
  bundleId: string;
  status: string;
}

export function StatusButtons({ bundleId, status }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const nextStatus = NEXT_STATUS[status];
  const nextLabel = NEXT_LABEL[status];

  if (!nextStatus) return null;

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await updateBundleStatus(bundleId, nextStatus);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Ukládám..." : nextLabel}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
