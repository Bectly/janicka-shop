"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, StarOff } from "lucide-react";
import { setActiveBundle, clearActiveBundle } from "../actions";

interface Props {
  bundleId: string;
  isActive: boolean;
}

export function ActiveBundleToggle({ bundleId, isActive }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        if (isActive) {
          await clearActiveBundle();
        } else {
          await setActiveBundle(bundleId);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba");
      }
    });
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
          isActive
            ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
        title={
          isActive ? "Odebrat aktivní balík" : "Nastavit jako aktivní balík"
        }
      >
        {isActive ? (
          <>
            <Star className="size-3 fill-current" />
            Aktivní
          </>
        ) : (
          <>
            <StarOff className="size-3" />
            Nastavit jako aktivní
          </>
        )}
      </button>
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </>
  );
}
