"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Check } from "lucide-react";

const VISIBLE_MS = 3000;

export function QuickAddToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(
    () => searchParams.get("added") === "1",
  );

  useEffect(() => {
    if (!visible) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("added");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
    // Mount-only: snapshot from initial searchParams. After router.replace
    // strips ?added, we don't want to re-trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-top-2"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
        <Check className="size-4" aria-hidden />
        Kousek přidán
      </div>
    </div>
  );
}
