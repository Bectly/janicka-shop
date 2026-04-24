import { NextResponse } from "next/server";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { renderEmailPreview, EMAIL_PREVIEW_TEMPLATES } from "@/lib/email";
import { getMailer } from "@/lib/email/smtp-transport";
import {
  FROM_ORDERS,
  FROM_INFO,
  FROM_NEWSLETTER,
  FROM_SUPPORT,
  REPLY_TO,
} from "@/lib/email/addresses";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Per-template-group envelope mapping — verifies that transactional vs. marketing
// vs. account vs. admin mail lands on the correct From address + Reply-To.
function fromForTemplate(templateKey: string): { from: string; replyTo: string; group: string } {
  const entry = EMAIL_PREVIEW_TEMPLATES.find((t) => t.key === templateKey);
  const group = entry?.group ?? "Objednávka";
  switch (group) {
    case "Objednávka":
    case "Po nákupu":
      return { from: FROM_ORDERS, replyTo: REPLY_TO, group };
    case "Marketing":
      return { from: FROM_NEWSLETTER, replyTo: REPLY_TO, group };
    case "Účet":
      return { from: FROM_SUPPORT, replyTo: REPLY_TO, group };
    case "Admin":
      return { from: FROM_INFO, replyTo: REPLY_TO, group };
    default:
      return { from: FROM_ORDERS, replyTo: REPLY_TO, group };
  }
}

function renderIndexPage(): string {
  const grouped = EMAIL_PREVIEW_TEMPLATES.reduce<Record<string, typeof EMAIL_PREVIEW_TEMPLATES>>(
    (acc, item) => {
      (acc[item.group] ??= []).push(item);
      return acc;
    },
    {},
  );

  const sections = Object.entries(grouped)
    .map(([group, items]) => {
      const rows = items
        .map(
          (t) => `
            <li style="margin: 0; padding: 10px 0; border-top: 1px solid #F3E9EE;">
              <a href="/api/admin/email-preview?template=${encodeURIComponent(t.key)}" style="text-decoration: none; color: #B8407A; font-weight: 500;">
                ${escapeHtml(t.label)}
              </a>
              <code style="display: block; margin-top: 2px; font-size: 11px; color: #6E5F67;">${escapeHtml(t.key)}</code>
            </li>`,
        )
        .join("");
      return `
        <section style="margin: 0 0 28px;">
          <h2 style="margin: 0 0 6px; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 22px; color: #2E2428;">${escapeHtml(group)}</h2>
          <ul style="margin: 0; padding: 0; list-style: none;">${rows}</ul>
        </section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Email Preview — Janička Shop</title>
  <style>
    body { margin: 0; padding: 40px 24px; background: #F5EFF2; color: #2E2428; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrap { max-width: 640px; margin: 0 auto; background: #FFFFFF; border: 1px solid #ECDFE5; border-radius: 16px; padding: 32px; }
    h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 30px; margin: 0 0 6px; }
    p.lead { margin: 0 0 24px; color: #6E5F67; font-size: 14px; line-height: 1.6; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Email Preview</h1>
    <p class="lead">Každý odkaz otevře šablonu s fixturovými daty — ideální pro vizuální QA před deployem. Všechny e-maily používají sdílený layout (<code>src/lib/email/layout.ts</code>). Přidej <code>&send=1&to=you@example.com</code> pro deliverability smoke.</p>
    ${sections}
  </div>
</body>
</html>`;
}

function isValidEmail(email: string): boolean {
  // Intentionally conservative — the route is admin-only, so this is just a
  // sanity check to catch typos, not adversarial input.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function GET(req: Request) {
  await connection();
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const template = url.searchParams.get("template");
  const mode = url.searchParams.get("mode"); // "subject" | "source"
  const send = url.searchParams.get("send") === "1";
  const to = url.searchParams.get("to");

  if (send) {
    if (!template) {
      return NextResponse.json({ error: "template is required when send=1" }, { status: 400 });
    }
    if (!to || !isValidEmail(to)) {
      return NextResponse.json({ error: "valid ?to=<email> is required" }, { status: 400 });
    }

    // Rate-limit to stop the admin UI from being a spam cannon: 10 live
    // sends / minute / IP is plenty for deliverability smoke-testing.
    const ip = await getClientIp();
    const rl = checkRateLimit(`email-preview-send:${ip}`, 10, 60_000);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded — wait a minute before sending more smoke emails" },
        { status: 429 },
      );
    }

    const preview = renderEmailPreview(template);
    if (!preview) {
      return NextResponse.json({ error: `Unknown template: ${template}` }, { status: 404 });
    }

    const mailer = getMailer();
    if (!mailer) {
      return NextResponse.json(
        { error: "SMTP not configured — set SMTP_HOST/SMTP_USER/SMTP_PASSWORD" },
        { status: 503 },
      );
    }

    const { from, replyTo, group } = fromForTemplate(template);

    try {
      const info = await mailer.sendMail({
        from,
        replyTo,
        to,
        subject: `[SMOKE] ${preview.subject}`,
        html: preview.html,
        headers: {
          "X-Janicka-Preview": "1",
          "X-Janicka-Template": template,
          "X-Janicka-Group": group,
        },
      });
      return NextResponse.json({
        ok: true,
        template,
        group,
        from,
        replyTo,
        to,
        subject: preview.subject,
        messageId: info.messageId,
        response: info.response ?? null,
        accepted: info.accepted ?? null,
        rejected: info.rejected ?? null,
      });
    } catch (err) {
      logger.error("[email-preview] smoke send failed", {
        template,
        to,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "send failed", detail: err instanceof Error ? err.message : String(err) },
        { status: 502 },
      );
    }
  }

  if (!template) {
    return new NextResponse(renderIndexPage(), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const preview = renderEmailPreview(template);
  if (!preview) {
    return NextResponse.json({ error: `Unknown template: ${template}` }, { status: 404 });
  }

  if (mode === "subject") {
    return NextResponse.json({ template, subject: preview.subject });
  }

  if (mode === "source") {
    return new NextResponse(preview.html, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(preview.html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
