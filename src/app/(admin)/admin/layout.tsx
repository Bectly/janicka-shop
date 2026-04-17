import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { AdminSidebar } from "@/components/admin/sidebar";
import { DevChatWidget } from "@/components/dev-chat/dev-chat-widget";

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

  return (
    <>
      <AdminSidebar userName={session.user.name ?? "Admin"} />
      <main id="main-content" className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
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
