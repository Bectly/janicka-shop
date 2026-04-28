/**
 * Live deliverability smoke — fires EVERY template registered in
 * `renderEmailPreview` through Resend and prints a per-template status report.
 * Intended for post-deploy manual verification with the bectly test inbox.
 *
 * Usage:
 *   TO=jkopecky666@gmail.com npx tsx scripts/smoke-send-real.ts
 *   # or filter: TO=... TEMPLATE=order-confirmation npx tsx scripts/smoke-send-real.ts
 *
 * Requires RESEND_API_KEY in the environment. Missing key exits with code 2 so
 * CI / cron can flag the gap loudly.
 */

import {
  renderEmailPreview,
  EMAIL_PREVIEW_TEMPLATES,
} from "../src/lib/email";
import { getMailer } from "../src/lib/email/resend-transport";
import {
  FROM_ORDERS,
  FROM_INFO,
  FROM_NEWSLETTER,
  FROM_SUPPORT,
  REPLY_TO,
} from "../src/lib/email/addresses";

const TO = process.env.TO ?? "jkopecky666@gmail.com";
const FILTER = process.env.TEMPLATE ?? null;

function fromForGroup(group: string): string {
  switch (group) {
    case "Objednávka":
    case "Po nákupu":
      return FROM_ORDERS;
    case "Marketing":
      return FROM_NEWSLETTER;
    case "Účet":
      return FROM_SUPPORT;
    case "Admin":
      return FROM_INFO;
    default:
      return FROM_ORDERS;
  }
}

interface Row {
  template: string;
  group: string;
  from: string;
  status: "sent" | "failed" | "skipped";
  messageId?: string | null;
  error?: string;
}

async function run(): Promise<void> {
  const mailer = getMailer();
  if (!mailer) {
    console.error(
      "\n✗ Resend not configured. Set RESEND_API_KEY before running this smoke.\n",
    );
    process.exit(2);
  }

  const targets = FILTER
    ? EMAIL_PREVIEW_TEMPLATES.filter((t) => t.key === FILTER)
    : EMAIL_PREVIEW_TEMPLATES;
  if (targets.length === 0) {
    console.error(`✗ No templates match TEMPLATE=${FILTER}`);
    process.exit(2);
  }

  console.log(
    `→ Smoke-sending ${targets.length} template(s) to ${TO} via Resend\n`,
  );

  const rows: Row[] = [];

  for (const tpl of targets) {
    const preview = renderEmailPreview(tpl.key);
    if (!preview) {
      rows.push({
        template: tpl.key,
        group: tpl.group,
        from: fromForGroup(tpl.group),
        status: "skipped",
        error: "renderEmailPreview returned null",
      });
      continue;
    }

    const from = fromForGroup(tpl.group);
    try {
      const info = await mailer.sendMail({
        from,
        replyTo: REPLY_TO,
        to: TO,
        subject: `[SMOKE] ${preview.subject}`,
        html: preview.html,
        headers: {
          "X-Janicka-Preview": "1",
          "X-Janicka-Template": tpl.key,
          "X-Janicka-Group": tpl.group,
        },
      });
      console.log(`  ✓ ${tpl.key.padEnd(32)} from=${from}  messageId=${info.messageId}`);
      rows.push({
        template: tpl.key,
        group: tpl.group,
        from,
        status: "sent",
        messageId: info.messageId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${tpl.key.padEnd(32)} FAILED  ${msg}`);
      rows.push({
        template: tpl.key,
        group: tpl.group,
        from,
        status: "failed",
        error: msg,
      });
    }
  }

  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const skipped = rows.filter((r) => r.status === "skipped").length;

  console.log("\n--- Summary ---");
  console.log(`sent:    ${sent}`);
  console.log(`failed:  ${failed}`);
  console.log(`skipped: ${skipped}`);
  console.log("\nVerify in inbox (raw headers):");
  console.log("  - DKIM-Signature: d=jvsatnik.cz … and dkim=pass in Authentication-Results");
  console.log("  - SPF: spf=pass smtp.mailfrom=jvsatnik.cz");
  console.log("  - From: matches per-group envelope (objednavky@ / novinky@ / podpora@ / info@)");
  console.log("  - Unsubscribe links in Marketing group round-trip through /api/unsubscribe");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("✗ smoke crashed:", err);
  process.exit(1);
});
