import { NextResponse } from "next/server";
import { sendTelegramAdminMessage } from "@/lib/telegram";

/**
 * UptimeRobot → Telegram alert webhook (#344).
 *
 * Auth: `X-Uptime-Secret` header OR `?token=` query param compared in constant
 *       time against `UPTIMEROBOT_WEBHOOK_SECRET`. If the env is unset the
 *       route returns 503 — we never silently accept unauthenticated payloads.
 *
 * Payload: UptimeRobot "Custom Web-Hook" with a JSON post value. Configure in
 *          UptimeRobot to send exactly:
 *            {
 *              "monitorFriendlyName": "*monitorFriendlyName*",
 *              "alertType": *alertType*,
 *              "alertTypeFriendlyName": "*alertTypeFriendlyName*",
 *              "alertDetails": "*alertDetails*",
 *              "monitorURL": "*monitorURL*"
 *            }
 *          alertType: 1 = Down, 2 = Up, 3 = SSL expiring.
 */

interface UptimePayload {
  monitorFriendlyName?: string;
  alertType?: number | string;
  alertTypeFriendlyName?: string;
  alertDetails?: string;
  monitorURL?: string;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function authenticate(request: Request): boolean {
  const expected = process.env.UPTIMEROBOT_WEBHOOK_SECRET;
  if (!expected) return false;
  const headerSecret = request.headers.get("x-uptime-secret");
  const querySecret = new URL(request.url).searchParams.get("token");
  const provided = headerSecret ?? querySecret ?? "";
  return provided.length > 0 && constantTimeEqual(provided, expected);
}

function formatMessage(payload: UptimePayload): string {
  const typeRaw = payload.alertType;
  const typeNum = typeof typeRaw === "string" ? Number.parseInt(typeRaw, 10) : typeRaw;
  const label =
    typeNum === 1
      ? "🔴 DOWN"
      : typeNum === 2
      ? "🟢 UP"
      : typeNum === 3
      ? "⚠️ SSL expiring"
      : payload.alertTypeFriendlyName ?? "ℹ️ Alert";

  const name = payload.monitorFriendlyName ?? "unknown monitor";
  const url = payload.monitorURL ?? "";
  const details = payload.alertDetails ?? "";

  const lines = [`${label} — ${name}`];
  if (url) lines.push(url);
  if (details) lines.push(details);
  return lines.join("\n");
}

export async function POST(request: Request) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: UptimePayload;
  try {
    payload = (await request.json()) as UptimePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = formatMessage(payload);
  const result = await sendTelegramAdminMessage(text);

  if (!result.sent) {
    console.error("[api/alerts/uptime] telegram delivery failed:", result);
    return NextResponse.json(
      { ok: false, delivered: false, reason: result.skipped ?? result.error ?? "unknown" },
      { status: result.skipped === "missing-env" ? 503 : 502 },
    );
  }

  return NextResponse.json({ ok: true, delivered: true });
}
