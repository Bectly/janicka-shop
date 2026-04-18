"use client";

export function JarvisRemoteFrame() {
  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] flex-col gap-4">
      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <p className="font-medium">Přihlášení do terminálu</p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
          <li>
            Přijde 6-místný kód z Cloudflare na tvůj email — zadej ho
          </li>
          <li>
            Pak ttyd basic auth — username: <code className="rounded bg-muted px-1 py-0.5 text-xs">jarvis</code>, heslo ti pošlu zvlášť
          </li>
          <li>Otevře se Claude Code terminal s přístupem k eshopu</li>
        </ol>
      </div>
      <iframe
        src="https://jarvis-janicka.jvsatnik.cz"
        title="JARVIS Remote Console"
        className="w-full flex-1 rounded-lg border bg-black"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
