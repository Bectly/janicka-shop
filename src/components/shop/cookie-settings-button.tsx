"use client";

export function CookieSettingsButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("show-cookie-consent"))}
      className="hover:text-foreground transition-colors"
    >
      Nastavení cookies
    </button>
  );
}
