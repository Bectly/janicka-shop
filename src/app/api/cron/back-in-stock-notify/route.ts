import { NextResponse } from "next/server";
import { getMailer } from "@/lib/email/smtp-transport";
import { FROM_NEWSLETTER, REPLY_TO } from "@/lib/email/addresses";
import { getDb } from "@/lib/db";
import { buildBackInStockHtml } from "@/lib/email/back-in-stock";
import { wrapCronRoute } from "@/lib/cron-metrics";
import { checkAndRecordEmailDispatch } from "@/lib/email-dedup";
import { logger } from "@/lib/logger";

/**
 * Back-in-stock notify cron — processes BackInStockSubscription records.
 *
 * Every 2 hours, finds unnotified subscriptions and matches them against
 * NEW products (added in the last 48h) by (brand + category + size + condition).
 * This is NOT exact-SKU matching — second-hand unique inventory means a
 * matching tuple is "close enough" for the buyer.
 *
 * Protected by CRON_SECRET. Batch limit: 50 per run.
 */
export const GET = wrapCronRoute("back-in-stock-notify", async () => {
  const mailer = getMailer();
  if (!mailer) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      reason: "SMTP not configured",
    });
  }

  const db = await getDb();
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const subscriptions = await db.backInStockSubscription.findMany({
      where: { notifiedAt: null },
      take: 50,
      orderBy: { createdAt: "asc" },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        skipped: 0,
        failed: 0,
        reason: "no pending subscriptions",
      });
    }

    for (const sub of subscriptions) {
      try {
        // Match NEW products against this subscription's tuple. brand/size/condition
        // are nullable → null means "any", so only add a where clause if the field
        // is set. Size lives inside a JSON array column (sizes), so we fetch and
        // post-filter rather than trying to use SQL JSON operators (not portable
        // across sqlite/libsql).
        const candidates = await db.product.findMany({
          where: {
            categoryId: sub.categoryId,
            active: true,
            sold: false,
            createdAt: { gte: fortyEightHoursAgo },
            ...(sub.brand ? { brand: sub.brand } : {}),
            ...(sub.condition ? { condition: sub.condition } : {}),
            ...(sub.sourceProductId
              ? { id: { not: sub.sourceProductId } }
              : {}),
          },
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            compareAt: true,
            brand: true,
            condition: true,
            images: true,
            sizes: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        if (candidates.length === 0) {
          skipped++;
          continue;
        }

        let matched = candidates;
        if (sub.size) {
          const wanted = sub.size;
          matched = candidates.filter((p) => {
            try {
              const sizes = JSON.parse(p.sizes);
              if (Array.isArray(sizes) && sizes.length === 0) return false;
              return Array.isArray(sizes) && sizes.includes(wanted);
            } catch {
              return false;
            }
          });
        }

        if (matched.length === 0) {
          skipped++;
          continue;
        }

        const top = matched[0];

        const allowed = await checkAndRecordEmailDispatch(
          sub.email,
          top.id,
          "back-in-stock",
        );
        if (!allowed) {
          // Mark subscription as notified so we don't re-evaluate next run —
          // dedup is the authority, not the subscription state.
          await db.backInStockSubscription.update({
            where: { id: sub.id },
            data: { notifiedAt: now, notifiedProductId: top.id },
          });
          skipped++;
          continue;
        }

        await mailer.sendMail({
          from: FROM_NEWSLETTER,
          replyTo: REPLY_TO,
          to: sub.email,
          subject: "Přidali jsme kousek, který jsi hlídala",
          html: buildBackInStockHtml(
            top,
            { brand: sub.brand, size: sub.size, condition: sub.condition },
            sub.email,
          ),
        });

        await db.backInStockSubscription.update({
          where: { id: sub.id },
          data: { notifiedAt: now, notifiedProductId: top.id },
        });

        sent++;
      } catch (err) {
        logger.error(
          `[Cron:back-in-stock] Failed for subscription ${sub.id} (${sub.email}):`,
          err,
        );
        failed++;
      }
    }
  } catch (error) {
    logger.error("[Cron:back-in-stock] Error:", error);
    return NextResponse.json(
      { error: "Internal error", sent, skipped, failed },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
});
