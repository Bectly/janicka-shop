"use client";

export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("show-cookie-consent"))}
      className={className || "hover:text-foreground transition-colors"}
    >
      Nastavení cookies
    </button>
  );
}
