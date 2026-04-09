import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/lib/auth";
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

  return (
    <>
      <AdminSidebar userName={session.user.name ?? "Admin"} />
      <main id="main-content" className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <DevChatWidget />
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
