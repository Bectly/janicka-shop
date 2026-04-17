"use client";

import { useTransition, useState } from "react";
import { updateReturnStatus } from "../actions";
import { RETURN_STATUS_LABELS } from "@/lib/constants";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["approved", "rejected"],
  approved: ["completed", "rejected"],
  rejected: [],
  completed: [],
};

export function ReturnStatusSelect({
  returnId,
  currentStatus,
}: {
  returnId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const allowedNext = STATUS_TRANSITIONS[currentStatus] ?? [];

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value;
    if (newStatus === currentStatus) return;

    if (newStatus === "rejected") {
      setShowNote(true);
      return;
    }

    startTransition(async () => {
      await updateReturnStatus(returnId, newStatus, note || undefined);
      setShowNote(false);
      setNote("");
    });
  }

  function handleRejectConfirm() {
    startTransition(async () => {
      await updateReturnStatus(returnId, "rejected", note || undefined);
      setShowNote(false);
      setNote("");
    });
  }

  if (allowedNext.length === 0) {
    return (
      <span className="rounded-lg border bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
        {RETURN_STATUS_LABELS[currentStatus] ?? currentStatus}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={isPending}
        className="rounded-lg border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
      >
        <option value={currentStatus}>
          {RETURN_STATUS_LABELS[currentStatus] ?? currentStatus}
        </option>
        {allowedNext.map((status) => (
          <option key={status} value={status}>
            {RETURN_STATUS_LABELS[status] ?? status}
          </option>
        ))}
      </select>

      {showNote && (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Důvod zamítnutí..."
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={isPending}
            >
              {isPending ? "Ukládám..." : "Zamítnout"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNote(false)}
            >
              Zrušit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
