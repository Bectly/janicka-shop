"use client";

export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("show-cookie-consent"))}
      className={className || "transition-colors duration-150 hover:text-foreground"}
    >
      Nastavení cookies
    </button>
  );
}
