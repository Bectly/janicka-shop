import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminOrderNotifier } from "@/components/admin/order-notifier";
import { DevChatWidget } from "@/components/dev-chat/dev-chat-widget";
import { GlobalSearch } from "@/components/admin/global-search";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";

async function AdminAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  // Check onboarding status — redirect to welcome if not completed
  const db = await getDb();
  const admin = session.user.email
    ? await db.admin.findUnique({
        where: { email: session.user.email },
        select: { onboardedAt: true },
      })
    : null;

  if (!admin?.onboardedAt) {
    redirect("/admin/welcome");
  }

  // Sidebar badge: count of orders created in the last 24h
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [ordersLast24h, settings] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: yesterday } } }),
    db.shopSettings.findUnique({
      where: { id: "singleton" },
      select: { soundNotifications: true },
    }),
  ]);

  return (
    <>
      <AdminSidebar
        userName={session.user.name ?? "Admin"}
        ordersLast24h={ordersLast24h}
      />
      <main id="main-content" className="flex-1 overflow-auto">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b bg-card/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <Breadcrumbs />
          <GlobalSearch />
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <AdminOrderNotifier soundEnabled={settings?.soundNotifications ?? false} />
      <Suspense>
        <DevChatWidget />
      </Suspense>
    </>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Suspense>
        <AdminAuthGate>{children}</AdminAuthGate>
      </Suspense>
    </div>
  );
}
