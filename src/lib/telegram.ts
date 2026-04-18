/**
 * Minimal Telegram Bot API helper.
 *
 * Used for operational alerts (UptimeRobot → /api/alerts/uptime → here).
 * Returns `{ sent: false }` instead of throwing when env is unset so callers
 * can short-circuit gracefully in dev/preview.
 */

export interface TelegramSendResult {
  sent: boolean;
  skipped?: "missing-env";
  status?: number;
  error?: string;
}

const TELEGRAM_API = "https://api.telegram.org";

export async function sendTelegramAdminMessage(
  text: string,
  options: { parseMode?: "HTML" | "MarkdownV2"; disablePreview?: boolean } = {},
): Promise<TelegramSendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    return { sent: false, skipped: "missing-env" };
  }

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: options.disablePreview ?? true,
  };
  if (options.parseMode) body.parse_mode = options.parseMode;

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { sent: false, status: res.status, error: detail.slice(0, 200) };
    }
    return { sent: true, status: res.status };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}
