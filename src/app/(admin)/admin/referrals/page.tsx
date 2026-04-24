import { Suspense } from "react";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import { Gift, Ticket, Wallet, TrendingUp, Users } from "lucide-react";
import { Pagination, PaginationSkeleton } from "@/components/shop/pagination";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Referraly & Kredity",
};

const ADMIN_REFERRALS_PER_PAGE = 25;

const REFERRAL_STATUS_LABELS: Record<string, string> = {
  pending: "Čeká",
  redeemed: "Využito",
  expired: "Vypršelo",
};

const REFERRAL_STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  redeemed: "bg-green-100 text-green-800",
  expired: "bg-muted text-muted-foreground",
};

async function getReferralsPageData(
  currentPage: number,
  activeTab: "credits" | "referrals",
  status: string,
) {
  "use cache";
  cacheLife("minutes");
  cacheTag("admin-referrals");

  const db = await getDb();
  const referralWhere: Record<string, unknown> = {};
  const VALID_STATUSES = ["pending", "redeemed", "expired"];
  if (status && status !== "all" && VALID_STATUSES.includes(status)) {
    referralWhere.status = status;
  }

  let referralCount = 0;
  let referralCodes: Awaited<ReturnType<typeof db.referralCode.findMany>> = [];
  let creditsCount = 0;
  let storeCredits: Awaited<ReturnType<typeof db.storeCredit.findMany>> = [];

  if (activeTab === "referrals") {
    [referralCount, referralCodes] = await Promise.all([
      db.referralCode.count({ where: referralWhere }),
      db.referralCode.findMany({
        where: referralWhere,
        orderBy: { createdAt: "desc" },
        skip: (currentPage - 1) * ADMIN_REFERRALS_PER_PAGE,
        take: ADMIN_REFERRALS_PER_PAGE,
      }),
    ]);
  } else {
    [creditsCount, storeCredits] = await Promise.all([
      db.storeCredit.count(),
      db.storeCredit.findMany({
        orderBy: { createdAt: "desc" },
        skip: (currentPage - 1) * ADMIN_REFERRALS_PER_PAGE,
        take: ADMIN_REFERRALS_PER_PAGE,
      }),
    ]);
  }

  const [totalCodes, redeemedCodes, allCredits] = await Promise.all([
    db.referralCode.count(),
    db.referralCode.count({ where: { status: "redeemed" } }),
    db.storeCredit.findMany({ select: { amount: true, remainingAmount: true } }),
  ]);

  const redemptionRate = totalCodes > 0 ? Math.round((redeemedCodes / totalCodes) * 100) : 0;
  const totalCreditIssued = allCredits.reduce((sum, c) => sum + c.amount, 0);
  const totalCreditUsed = allCredits.reduce((sum, c) => sum + (c.amount - c.remainingAmount), 0);

  return {
    referralCount,
    referralCodes,
    creditsCount,
    storeCredits,
    totalCodes,
    redeemedCodes,
    redemptionRate,
    totalCreditIssued,
    totalCreditUsed,
  };
}

export default async function AdminReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tab?: string; page?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);
  const activeTab: "credits" | "referrals" = params.tab === "credits" ? "credits" : "referrals";

  const {
    referralCount,
    referralCodes,
    creditsCount,
    storeCredits,
    totalCodes,
    redeemedCodes,
    redemptionRate,
    totalCreditIssued,
    totalCreditUsed,
  } = await getReferralsPageData(currentPage, activeTab, params.status ?? "");

  const activeStatus = params.status || "all";

  const statusFilters = [
    { value: "all", label: "Všechny" },
    { value: "pending", label: "Čeká" },
    { value: "redeemed", label: "Využito" },
    { value: "expired", label: "Vypršelo" },
  ];

  const now = new Date();

  return (
    <>
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Referraly & Kredity
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Přehled referral kódů a kreditů zákazníků
        </p>
      </div>

      {/* Stats summary */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Ticket className="size-4" />
            <span className="text-xs font-medium">Kódů celkem</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{totalCodes}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="size-4" />
            <span className="text-xs font-medium">Míra využití</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {redemptionRate}%
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              ({redeemedCodes}/{totalCodes})
            </span>
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="size-4" />
            <span className="text-xs font-medium">Kredity vydáno</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatPrice(totalCreditIssued)}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            <span className="text-xs font-medium">Kredity čerpáno</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">{formatPrice(totalCreditUsed)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b">
        <Link
          href="/admin/referrals"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "referrals"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Gift className="size-4" />
            Referral kódy
          </span>
        </Link>
        <Link
          href="/admin/referrals?tab=credits"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "credits"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-2">
            <Wallet className="size-4" />
            Kredity zákazníků
          </span>
        </Link>
      </div>

      {activeTab === "referrals" ? (
        <>
          {/* Status filter */}
          <div className="mt-4 flex flex-wrap gap-2">
            {statusFilters.map((filter) => {
              const href = new URLSearchParams();
              if (filter.value !== "all") href.set("status", filter.value);
              const hrefStr = href.toString();
              return (
                <Link
                  key={filter.value}
                  href={`/admin/referrals${hrefStr ? `?${hrefStr}` : ""}`}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeStatus === filter.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {filter.label}
                </Link>
              );
            })}
          </div>

          {/* Referral codes table */}
          <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Kód
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Referrer
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Zdrojová obj.
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Sleva kamarádka
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Kredit referrer
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Využito obj.
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Vytvořeno
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Vyprší
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {referralCodes.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Gift className="h-8 w-8 text-muted-foreground/40" />
                          <p className="font-medium text-muted-foreground">Žádné referral kódy</p>
                          <p className="text-sm text-muted-foreground/60">Referral kódy se generují automaticky po prvním nákupu zákazníka.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    referralCodes.map((rc) => {
                      const isExpired = rc.status === "pending" && rc.expiresAt < now;
                      const displayStatus = isExpired ? "expired" : rc.status;
                      return (
                        <tr
                          key={rc.id}
                          className="border-b last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-medium text-foreground">
                              {rc.code}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {rc.customerEmail}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground">
                              {rc.orderNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                REFERRAL_STATUS_COLORS[displayStatus] ?? "bg-muted text-muted-foreground"
                              }`}
                            >
                              {REFERRAL_STATUS_LABELS[displayStatus] ?? displayStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {formatPrice(rc.discountAmount)}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {formatPrice(rc.creditAmount)}
                          </td>
                          <td className="px-4 py-3">
                            {rc.usedByOrderNumber ? (
                              <span className="text-xs text-muted-foreground">
                                {rc.usedByOrderNumber}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatDate(rc.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatDate(rc.expiresAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Suspense fallback={<PaginationSkeleton />}>
            <Pagination
              totalItems={referralCount}
              perPage={ADMIN_REFERRALS_PER_PAGE}
              basePath="/admin/referrals"
            />
          </Suspense>
        </>
      ) : (
        <>
          {/* Store credits table */}
          <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Zákazník
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Celkem
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Zbývá
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Důvod
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Zdrojová obj.
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Vytvořeno
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Vyprší
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Stav
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {storeCredits.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Ticket className="h-8 w-8 text-muted-foreground/40" />
                          <p className="font-medium text-muted-foreground">Žádné store kredity</p>
                          <p className="text-sm text-muted-foreground/60">Store kredity jsou vydávány zákazníkům jako kompenzace nebo odměna.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    storeCredits.map((sc) => {
                      const isFullyUsed = sc.remainingAmount === 0;
                      const isExpired = !isFullyUsed && sc.expiresAt < now;
                      const creditStatus = isFullyUsed
                        ? "Vyčerpáno"
                        : isExpired
                          ? "Vypršelo"
                          : "Aktivní";
                      const creditStatusColor = isFullyUsed
                        ? "bg-muted text-muted-foreground"
                        : isExpired
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800";
                      return (
                        <tr
                          key={sc.id}
                          className="border-b last:border-0 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 text-foreground">
                            {sc.customerEmail}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatPrice(sc.amount)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {formatPrice(sc.remainingAmount)}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {sc.reason}
                          </td>
                          <td className="px-4 py-3">
                            {sc.sourceOrderNumber ? (
                              <span className="text-xs text-muted-foreground">
                                {sc.sourceOrderNumber}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatDate(sc.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {formatDate(sc.expiresAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${creditStatusColor}`}
                            >
                              {creditStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Suspense fallback={<PaginationSkeleton />}>
            <Pagination
              totalItems={creditsCount}
              perPage={ADMIN_REFERRALS_PER_PAGE}
              basePath="/admin/referrals"
            />
          </Suspense>
        </>
      )}
    </>
  );
}
