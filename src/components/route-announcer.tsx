"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Announces route changes to screen readers and manages focus on navigation.
 * WCAG 2.1 AA requirement for SPA-style navigation in Next.js App Router.
 */
export function RouteAnnouncer() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState("");
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (pathname === previousPathname.current) return;
    previousPathname.current = pathname;

    // Focus main content on route change for keyboard users
    const main = document.getElementById("main-content");
    if (main) {
      // Make it focusable without adding it to tab order
      if (!main.hasAttribute("tabindex")) {
        main.setAttribute("tabindex", "-1");
        main.style.outline = "none";
      }
      main.focus({ preventScroll: true });
    }

    // Announce the new page title to screen readers
    requestAnimationFrame(() => {
      const title = document.title;
      setAnnouncement(title || "Stránka načtena");
    });
  }, [pathname]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
