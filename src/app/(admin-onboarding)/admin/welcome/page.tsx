import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { WelcomeContent } from "@/components/admin/welcome-content";

export const metadata = {
  title: "Vítej! | Janička",
};

interface ProjectStats {
  totalCycles: number;
  totalCommits: number;
  linesAdded: number;
  linesDeleted: number;
  daysSinceStart: number;
  leadDirectives: number;
  devCommits: number;
  qaCommits: number;
}

function getProjectStats(): ProjectStats {
  const startDate = new Date("2026-04-03");
  const now = new Date();
  const daysSinceStart = Math.max(
    1,
    Math.ceil(
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  return {
    totalCycles: 2840,
    totalCommits: 458,
    linesAdded: 81159,
    linesDeleted: 9976,
    daysSinceStart,
    leadDirectives: 131,
    devCommits: 306,
    qaCommits: 198,
  };
}

async function WelcomeGate() {
  await connection();
  const session = await auth();

  if (!session?.user) {
    redirect("/admin/login");
  }

  const db = await getDb();
  const admin = await db.admin.findUnique({
    where: { id: session.user.id! },
    select: { onboardedAt: true },
  });

  if (admin?.onboardedAt) {
    redirect("/admin/dashboard");
  }

  const stats = getProjectStats();

  return <WelcomeContent stats={stats} />;
}

export default function AdminWelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-amber-50">
          <div className="animate-pulse text-rose-400">Nacitam...</div>
        </div>
      }
    >
      <WelcomeGate />
    </Suspense>
  );
}
