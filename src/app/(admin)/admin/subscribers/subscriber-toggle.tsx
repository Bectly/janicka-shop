"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSubscriberActive } from "./actions";

export function SubscriberToggle({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleSubscriberActive(id, !active);
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
        active
          ? "bg-primary/10 text-primary hover:bg-primary/20"
          : "bg-destructive/10 text-destructive hover:bg-destructive/20"
      } ${isPending ? "opacity-50" : ""}`}
    >
      {active ? "Aktivní" : "Odhlášen"}
    </button>
  );
}
