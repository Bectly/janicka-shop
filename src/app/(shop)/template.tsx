"use client";

import type { ReactNode } from "react";

/**
 * Shop route template — re-mounts on every navigation, triggering
 * a subtle fade-up entrance animation for page content.
 * Uses pure CSS animation (no JS library). Respects prefers-reduced-motion.
 */
export default function ShopTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-page-enter">{children}</div>;
}
