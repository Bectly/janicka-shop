import { AlertTriangle } from "lucide-react";

export function EnvHealthBanner() {
  const missing: Array<{ name: string; purpose: string; command: string }> = [];

  if (!process.env.UNSUBSCRIBE_HMAC_SECRET) {
    missing.push({
      name: "UNSUBSCRIBE_HMAC_SECRET",
      purpose:
        "Podepisuje odhlašovací odkazy v e-mailech (GDPR). Bez něj fungují ve fallback režimu bez HMAC ochrany proti enumeraci.",
      command: "openssl rand -hex 32",
    });
  }

  if (missing.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-red-100 p-2 text-red-700">
          <AlertTriangle className="size-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-heading text-base font-semibold text-red-900">
            Chybějící environment proměnné
          </h2>
          <p className="mt-1 text-sm text-red-800">
            Na produkci nejsou nastavené tyto proměnné. Přidej je ve Vercel →
            Settings → Environment Variables a znovu deploy.
          </p>
          <ul className="mt-4 space-y-4">
            {missing.map((item) => (
              <li key={item.name} className="rounded-lg border border-red-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded bg-red-100 px-2 py-0.5 font-mono text-xs font-semibold text-red-900">
                    {item.name}
                  </code>
                </div>
                <p className="mt-2 text-sm text-foreground">{item.purpose}</p>
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Vygeneruj hodnotu v terminálu:
                  </p>
                  <pre className="mt-1 overflow-x-auto rounded bg-slate-900 px-3 py-2 text-xs text-slate-100">
                    <code>{item.command}</code>
                  </pre>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
