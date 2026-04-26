"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("[Admin] Unhandled error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-7 text-destructive" />
      </div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        V adminu něco selhalo
      </h1>
      <p className="mt-3 text-muted-foreground">
        Zkuste operaci zopakovat. Pokud chyba přetrvává, kontaktuj devs.
        Obnovení stránky ti nic nerozbije.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted-foreground">
          Referenční kód: <code className="font-mono">{error.digest}</code>
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button size="lg" onClick={reset} className="gap-2">
          <RotateCcw className="size-4" />
          Zkusit znovu
        </Button>
        <Button
          size="lg"
          variant="outline"
          render={<Link href="/admin/dashboard" />}
          className="gap-2"
        >
          <LayoutDashboard className="size-4" />
          Zpět na dashboard
        </Button>
      </div>
    </div>
  );
}
