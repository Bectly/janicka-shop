import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getAdminBadges } from "@/lib/admin-badges";
import { AdminSidebar, AdminSidebarMobileTrigger } from "@/components/admin/sidebar";
import { AdminOrderNotifier } from "@/components/admin/order-notifier";
import { GlobalSearch } from "@/components/admin/global-search";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import {
  JarvisConsoleOverlay,
  JarvisConsoleToggle,
} from "@/components/admin/jarvis-console-overlay";

// #524f Phase 1b: opt-in wall-clock instrumentation for pre/post cache-fix
// baseline. Enable by setting PERF_PROFILE=1 in Vercel env. Emits console.time
// labels on stdout with a unique marker per admin nav so Vercel log filters
// pick them up; zero overhead when the flag is off.
const PERF_PROFILE = process.env.PERF_PROFILE === "1";

function perfStart(label: string) {
  if (PERF_PROFILE) console.time(`[perf] ${label}`);
}
function perfEnd(label: string) {
  if (PERF_PROFILE) console.timeEnd(`[perf] ${label}`);
}

async function AdminAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const navId = PERF_PROFILE
    ? // eslint-disable-next-line react-hooks/purity -- debug-only instrumentation gated by PERF_PROFILE env flag; dead code in production unless flag is set. navId only needs uniqueness per request for Vercel log filtering.
      `admin-nav-${Math.random().toString(36).slice(2, 8)}`
    : "";
  perfStart(`${navId} total`);
  await connection();
  perfStart(`${navId} session.auth`);
  const session = await auth();
  perfEnd(`${navId} session.auth`);

  if (!session?.user) {
    redirect("/admin/login");
  }

  // Check onboarding status — redirect to welcome if not completed
  const db = await getDb();
  perfStart(`${navId} admin.findUnique`);
  const admin = session.user.email
    ? await db.admin.findUnique({
        where: { email: session.user.email },
        select: { onboardedAt: true },
      })
    : null;
  perfEnd(`${navId} admin.findUnique`);

  if (!admin?.onboardedAt) {
    redirect("/admin/welcome");
  }

  // Badge trio — cached via "use cache" + cacheTag("admin-badges"); writers
  // in order/settings/mailbox actions call revalidateTag to drop the entry.
  // Cache hit: 0 Prisma RTTs. Miss: 3 parallel queries (~150-300ms Turso).
  perfStart(`${navId} badge-trio`);
  const { ordersLast24h, soundNotifications, mailboxUnread } =
    await getAdminBadges();
  perfEnd(`${navId} badge-trio`);
  perfEnd(`${navId} total`);

  return (
    <>
      <AdminSidebar
        userName={session.user.name ?? "Admin"}
        ordersLast24h={ordersLast24h}
        mailboxUnread={mailboxUnread}
      />
      <main id="main-content" className="flex-1 overflow-auto">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-card/95 px-3 backdrop-blur-sm sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <AdminSidebarMobileTrigger
              userName={session.user.name ?? "Admin"}
              ordersLast24h={ordersLast24h}
              mailboxUnread={mailboxUnread}
            />
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <JarvisConsoleToggle />
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <AdminOrderNotifier soundEnabled={soundNotifications} />
      <JarvisConsoleOverlay />
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
