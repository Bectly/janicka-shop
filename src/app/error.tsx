"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, Mail, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("[App] Unhandled error:", error);
  }, [error]);

  const subject = encodeURIComponent("Chyba na janicka-shop.cz");
  const body = encodeURIComponent(
    `Ahoj,\n\nnarazila jsem na chybu.\n\nReferenční kód: ${error.digest ?? "n/a"}\nURL: ${typeof window !== "undefined" ? window.location.href : "n/a"}\n\n`,
  );

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-7 text-destructive" />
      </div>
      <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
        Něco se pokazilo
      </h1>
      <p className="mt-3 text-muted-foreground">
        Omlouváme se, na stránce došlo k neočekávané chybě. Zkuste to prosím
        znovu, nebo se vraťte na hlavní stránku.
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
          render={<Link href="/" />}
          className="gap-2"
        >
          <Home className="size-4" />
          Na hlavní stránku
        </Button>
      </div>

      <a
        href={`mailto:kontakt@janicka-shop.cz?subject=${subject}&body=${body}`}
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary hover:underline"
      >
        <Mail className="size-3.5" />
        Nahlásit chybu
      </a>
    </div>
  );
}
