import { NextResponse } from "next/server";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { renderEmailPreview, EMAIL_PREVIEW_TEMPLATES } from "@/lib/email";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    <p class="lead">Každý odkaz otevře šablonu s fixturovými daty — ideální pro vizuální QA před deployem. Všechny e-maily používají sdílený layout (<code>src/lib/email/layout.ts</code>).</p>
    ${sections}
  </div>
</body>
</html>`;
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
