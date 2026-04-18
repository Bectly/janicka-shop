import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { parseJsonStringArray } from "@/lib/images";
import { connection } from "next/server";

import { Mail } from "lucide-react";
import { Pagination, PaginationSkeleton } from "@/components/shop/pagination";
import type { Metadata } from "next";
import { SubscriberToggle } from "./subscriber-toggle";
import { ExportCsvButton } from "./export-csv-button";
import { CampaignSender } from "./campaign-sender";
import { MothersDayCampaignButton } from "./mothers-day-campaign-button";
import { CustomsCampaignButton } from "./customs-campaign-button";

export const metadata: Metadata = {
  title: "Newsletter odběratelé",
};

const ADMIN_SUBSCRIBERS_PER_PAGE = 25;

function safeJsonParseArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function AdminSubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);

  await connection();
  const db = await getDb();

  const [totalCount, activeCount, withPrefs, subscribers, categories] =
    await Promise.all([
      db.newsletterSubscriber.count(),
      db.newsletterSubscriber.count({ where: { active: true } }),
      db.newsletterSubscriber.count({
        where: {
          OR: [
            { preferredSizes: { not: "[]" } },
            { preferredCategories: { not: "[]" } },
            { preferredBrands: { not: "[]" } },
          ],
        },
      }),
      db.newsletterSubscriber.findMany({
        orderBy: { createdAt: "desc" },
        skip: (currentPage - 1) * ADMIN_SUBSCRIBERS_PER_PAGE,
        take: ADMIN_SUBSCRIBERS_PER_PAGE,
      }),
      db.category.findMany({
        select: { id: true, name: true },
      }),
    ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Load collections + campaign history for CampaignSender
  const [collections, campaignHistory] = await Promise.all([
    db.collection.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, productIds: true },
    }),
    db.campaignLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const collectionOptions = collections.map((c) => ({
    id: c.id,
    title: c.title,
    productCount: parseJsonStringArray(c.productIds).length,
  }));

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Newsletter odběratelé
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCount} aktivních z {totalCount} celkem
            {withPrefs > 0 && ` · ${withPrefs} s preferencemi`}
          </p>
        </div>
        <ExportCsvButton />
      </div>

      <div className="mt-6 space-y-4">
        <MothersDayCampaignButton activeSubscriberCount={activeCount} />
        <CustomsCampaignButton activeSubscriberCount={activeCount} />
      </div>

      <CampaignSender
        collections={collectionOptions}
        activeSubscriberCount={activeCount}
        initialHistory={campaignHistory}
      />

      {totalCount === 0 ? (
        <div className="mt-12 rounded-xl border bg-card p-12 text-center shadow-sm">
          <Mail className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            Zatím žádní odběratelé
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Odběratelé se přidají přes newsletter formulář na webu.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    E-mail
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                    Preference
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">
                    Zdroj
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Přihlášen
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Stav
                  </th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub) => {
                  const sizes = safeJsonParseArray(sub.preferredSizes);
                  const catIds = safeJsonParseArray(sub.preferredCategories);
                  const brands = safeJsonParseArray(sub.preferredBrands);
                  const catNames = catIds
                    .map((id) => categoryMap.get(id))
                    .filter(Boolean);
                  const hasPrefs =
                    sizes.length > 0 ||
                    catNames.length > 0 ||
                    brands.length > 0;

                  return (
                    <tr
                      key={sub.id}
                      className="border-b last:border-0 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">
                          {sub.email}
                        </span>
                        {sub.firstName && (
                          <p className="text-xs text-muted-foreground">
                            {sub.firstName}
                          </p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {hasPrefs ? (
                          <div className="flex flex-wrap gap-1">
                            {sizes.map((s) => (
                              <span
                                key={s}
                                className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary"
                              >
                                {s}
                              </span>
                            ))}
                            {catNames.map((c) => (
                              <span
                                key={c}
                                className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700"
                              >
                                {c}
                              </span>
                            ))}
                            {brands.map((b) => (
                              <span
                                key={b}
                                className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
                        {sub.source === "checkout"
                          ? "Pokladna"
                          : sub.source === "import"
                            ? "Import"
                            : "Web"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(sub.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <SubscriberToggle id={sub.id} active={sub.active} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Suspense fallback={<PaginationSkeleton />}>
        <Pagination
          totalItems={totalCount}
          perPage={ADMIN_SUBSCRIBERS_PER_PAGE}
          basePath="/admin/subscribers"
        />
      </Suspense>
    </>
  );
}
