import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/lib/db";

export type AdminBadges = {
  ordersLast24h: number;
  soundNotifications: boolean;
  mailboxUnread: number;
};

/**
 * Cached shop-wide counters rendered in the admin sidebar + header on every
 * nav. Hit on a warm cache: 0 Prisma RTTs. Invalidated via
 * `revalidateTag("admin-badges")` from order/settings/mailbox writers — see
 * docs/audits/perf-audit-2026-04-24.md #1.
 *
 * Must stay keyed on nothing (no args): badges are identical for every admin.
 * The 24h window shifts in ~minute increments, which is acceptable here.
 */
export async function getAdminBadges(): Promise<AdminBadges> {
  "use cache";
  cacheLife("minutes");
  cacheTag("admin-badges");

  const db = await getDb();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [ordersLast24h, settings, mailboxUnread] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: yesterday } } }),
    db.shopSettings.findUnique({
      where: { id: "singleton" },
      select: { soundNotifications: true },
    }),
    db.emailThread
      .aggregate({
        where: { archived: false, trashed: false },
        _sum: { unreadCount: true },
      })
      .then((r) => r._sum.unreadCount ?? 0)
      .catch(() => 0),
  ]);

  return {
    ordersLast24h,
    soundNotifications: settings?.soundNotifications ?? false,
    mailboxUnread,
  };
}
