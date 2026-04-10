"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Checkout] Unhandled error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-7 text-destructive" />
      </div>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Něco se pokazilo
      </h1>
      <p className="mt-2 text-muted-foreground">
        Při načítání objednávky došlo k chybě. Vaše položky v košíku zůstávají
        uložené.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button size="lg" onClick={reset} className="gap-2">
          <RotateCcw className="size-4" />
          Zkusit znovu
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="gap-2"
          render={<Link href="/cart" />}
        >
          <ArrowLeft className="size-4" />
          Zpět do košíku
        </Button>
      </div>
    </div>
  );
}
