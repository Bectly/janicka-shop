import { Suspense } from "react";
import { execSync } from "child_process";
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

function git(cmd: string, timeoutMs = 10000): string | null {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: timeoutMs }).trim();
  } catch {
    return null;
  }
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

  const totalCommits = parseInt(git("git rev-list --count HEAD") ?? "", 10) || 0;

  let linesAdded = 0;
  let linesDeleted = 0;
  const diffstat = git(
    "git log --shortstat --format='' | awk '{ins+=$4; del+=$6} END {print ins, del}'",
    30000
  );
  if (diffstat) {
    const [added, deleted] = diffstat.split(/\s+/);
    linesAdded = parseInt(added, 10) || 0;
    linesDeleted = parseInt(deleted, 10) || 0;
  }

  const leadDirectives = parseInt(git("git log --oneline | grep -c Lead || echo 0") ?? "", 10) || 0;
  const devCommits = parseInt(git("git log --oneline | grep -cE ': (Bolt|Sage|Aria) ' || echo 0") ?? "", 10) || 0;
  const qaCommits = parseInt(git("git log --oneline | grep -cE ': (Trace|Guard) ' || echo 0") ?? "", 10) || 0;

  let totalCycles = totalCommits;
  const cycleMatch = git("git log --oneline -1 | grep -oP 'Cycle #\\K[0-9]+'");
  if (cycleMatch) {
    totalCycles = parseInt(cycleMatch, 10) || totalCommits;
  }

  return {
    totalCycles,
    totalCommits,
    linesAdded,
    linesDeleted,
    daysSinceStart,
    leadDirectives,
    devCommits,
    qaCommits,
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
    where: { email: session.user.email! },
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
          <div className="animate-pulse text-rose-400">Načítám...</div>
        </div>
      }
    >
      <WelcomeGate />
    </Suspense>
  );
}
