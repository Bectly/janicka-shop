import { NextResponse, connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

/**
 * Reactive admin foundation (R1). Single endpoint that returns the union of
 * counters/timestamps the admin shell polls every 15s (focused) / 60s (blur)
 * via TanStack Query. Adding a new badge = one parallel Prisma query here +
 * one field in the LiveState type — no new endpoints, no new infra.
 *
 * Auth: NextAuth admin session required (returns 401 otherwise).
 */
export async function GET() {
  await connection();
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const [
    mailboxUnread,
    mailboxTotal,
    mailboxLatest,
    workspaceTabs,
    managerUnreadThreads,
    managerLatestReply,
    paidNotShipped,
    newOrders5m,
    latestOrder,
    activeBatches,
    mostRecentBatch,
  ] = await Promise.all([
    db.emailThread.aggregate({
      _sum: { unreadCount: true },
      where: { trashed: false, archived: false },
    }),
    db.emailThread.count({ where: { trashed: false } }),
    // R2: include thread id + subject + latest inbound sender so the toast
    // can render "Nový email od [sender]" without a second roundtrip.
    db.emailThread.findFirst({
      where: { trashed: false, archived: false, unreadCount: { gt: 0 } },
      orderBy: { lastMessageAt: "desc" },
      select: {
        id: true,
        subject: true,
        lastMessageAt: true,
        messages: {
          where: { direction: "inbound" },
          orderBy: { receivedAt: "desc" },
          take: 1,
          select: { fromAddress: true, fromName: true },
        },
      },
    }),
    db.managerWorkspaceTab.findMany({
      where: { status: { in: ["active", "pinned"] } },
      orderBy: { lastActivityAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        lastActivityAt: true,
        messages: {
          where: { readAt: null, role: { in: ["manager", "system"] } },
          select: { id: true },
        },
      },
    }),
    db.managerThreadMessage.count({
      where: { readAt: null, role: "manager" },
    }),
    db.managerThreadMessage.findFirst({
      where: { role: "manager" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.order.count({
      where: { status: "paid", shippedAt: null },
    }),
    db.order.count({
      where: { createdAt: { gt: fiveMinAgo } },
    }),
    db.order.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
    db.productDraftBatch.count({
      where: { status: { in: ["open", "sealed"] } },
    }),
    db.productDraftBatch.findFirst({
      where: { status: { in: ["open", "sealed"] } },
      orderBy: { lastActivityAt: "desc" },
      select: {
        id: true,
        status: true,
        _count: { select: { drafts: true } },
        drafts: { where: { publishedProductId: { not: null } }, select: { id: true } },
      },
    }),
  ]);

  const tabs = workspaceTabs.map((t) => ({
    tabId: t.id,
    title: t.title,
    lastActivityAt: t.lastActivityAt.toISOString(),
    unreadMessages: t.messages.length,
  }));

  let progress: { batchId: string; percent: number } | null = null;
  if (mostRecentBatch) {
    const total = mostRecentBatch._count.drafts;
    const published = mostRecentBatch.drafts.length;
    const percent =
      total === 0
        ? mostRecentBatch.status === "sealed"
          ? 100
          : 0
        : Math.round((published / total) * 100);
    progress = { batchId: mostRecentBatch.id, percent };
  }

  const latestUnreadMsg = mailboxLatest?.messages[0];
  const latestUnread = mailboxLatest
    ? {
        threadId: mailboxLatest.id,
        subject: mailboxLatest.subject,
        sender:
          latestUnreadMsg?.fromName?.trim() ||
          latestUnreadMsg?.fromAddress ||
          "Neznámý odesílatel",
      }
    : null;

  const latestOrderSummary = latestOrder
    ? {
        id: latestOrder.id,
        orderNumber: latestOrder.orderNumber,
        total: latestOrder.total,
        customerName:
          `${latestOrder.customer?.firstName ?? ""} ${latestOrder.customer?.lastName ?? ""}`.trim(),
      }
    : null;

  return NextResponse.json({
    ts: now.toISOString(),
    mailbox: {
      unreadCount: mailboxUnread._sum.unreadCount ?? 0,
      latestThreadAt: mailboxLatest?.lastMessageAt.toISOString() ?? null,
      totalThreads: mailboxTotal,
      latestUnread,
    },
    workspace: {
      tabs,
      totalActive: tabs.length,
    },
    manager: {
      unreadThreadCount: managerUnreadThreads,
      latestReplyAt: managerLatestReply?.createdAt.toISOString() ?? null,
    },
    orders: {
      paidNotShippedCount: paidNotShipped,
      newSince5MinCount: newOrders5m,
      latestOrderAt: latestOrder?.createdAt.toISOString() ?? null,
      latestOrder: latestOrderSummary,
    },
    drafts: {
      activeBatchCount: activeBatches,
      mostRecentBatchProgress: progress,
    },
  });
}
