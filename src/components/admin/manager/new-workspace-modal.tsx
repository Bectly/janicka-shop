"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createWorkspaceTabAction } from "@/app/(admin)/admin/manager/workspace/actions";

export function NewWorkspaceModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (tabId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Zadej název konverzace");
      return;
    }
    startTransition(async () => {
      setError(null);
      const r = await createWorkspaceTabAction(trimmed);
      if (!r.ok || !r.tab) {
        setError(r.error ?? "Vytvoření selhalo");
        return;
      }
      onCreated(r.tab.id);
      setTitle("");
      onOpenChange(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setTitle("");
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Nová konverzace s manažerkou</DialogTitle>
          <DialogDescription>
            Krátký název — třeba „Co objednat příští týden“ nebo „Email kampaň
            Den matek“.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Název konverzace…"
            maxLength={120}
            disabled={isPending}
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              Vytvořit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
