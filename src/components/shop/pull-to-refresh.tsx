"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 70;
const MAX_PULL = 110;

export function PullToRefresh() {
  const router = useRouter();
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchRef = useRef({ startY: 0, pulling: false });

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (window.scrollY > 5 || refreshing) return;
      touchRef.current = { startY: e.touches[0].clientY, pulling: false };
    },
    [refreshing],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (window.scrollY > 5 || refreshing) return;
      const dy = e.touches[0].clientY - touchRef.current.startY;

      if (dy > 10 && !touchRef.current.pulling) {
        touchRef.current.pulling = true;
      }
      if (!touchRef.current.pulling || dy <= 0) return;

      // Diminishing returns — feels like rubber-band
      const distance = Math.min(dy * 0.4, MAX_PULL);
      setPullDistance(distance);
    },
    [refreshing],
  );

  const handleTouchEnd = useCallback(() => {
    if (!touchRef.current.pulling) return;
    touchRef.current.pulling = false;

    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(PULL_THRESHOLD * 0.4);
      router.refresh();
      setTimeout(() => {
        setRefreshing(false);
        setPullDistance(0);
      }, 800);
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, refreshing, router]);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    if (!mq.matches) return;

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (pullDistance === 0 && !refreshing) return null;

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-14 z-30 flex justify-center lg:hidden"
      style={{
        transform: `translateY(${pullDistance - 36}px)`,
        transition: refreshing ? "transform 200ms ease" : undefined,
      }}
      aria-hidden="true"
    >
      <div className="flex size-9 items-center justify-center rounded-full border bg-background shadow-md">
        <RefreshCw
          className={`size-4 text-primary ${refreshing ? "animate-ptr-spin" : ""}`}
          style={{
            opacity: progress,
            transform: refreshing
              ? undefined
              : `rotate(${pullDistance * 3}deg)`,
          }}
        />
      </div>
    </div>
  );
}
