"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 60_000;

/**
 * Lightweight polling refresh — every 60s while the tab is visible the
 * router re-runs the RSC for /admin/manager so new artifacts and task
 * status changes appear without a manual reload. Mirrors the pattern in
 * `order-notifier.tsx`.
 */
export function ManagerPoll() {
  const router = useRouter();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    function tick() {
      if (document.hidden || !mountedRef.current) return;
      router.refresh();
    }

    const interval = window.setInterval(tick, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
