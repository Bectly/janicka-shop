import { getDb } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import { connection } from "next/server";
import { Eye, Mail, Check, Clock } from "lucide-react";
import { Suspense } from "react";
import { Pagination, PaginationSkeleton } from "@/components/shop/pagination";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prohlížení bez nákupu",
};

const ADMIN_BROWSE_PER_PAGE = 25;

const STATUS_LABELS: Record<string, string> = {
  pending: "Čeká",
  sent: "Odesláno",
  sold: "Prodáno",
  cart_added: "Přidáno do košíku",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  sold: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  cart_added: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export default async function AdminBrowseAbandonmentPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);

  await connection();
  const db = await getDb();

  const [totalCount, records] = await Promise.all([
    db.browseAbandonment.count(),
    db.browseAbandonment.findMany({
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ADMIN_BROWSE_PER_PAGE,
      take: ADMIN_BROWSE_PER_PAGE,
    }),
  ]);

  const sentCount = await db.browseAbandonment.count({
    where: { status: "sent" },
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Prohlížení bez nákupu
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount}{" "}
            {totalCount === 1
              ? "záznam"
              : totalCount >= 2 && totalCount <= 4
                ? "záznamy"
                : "záznamů"}{" "}
            celkem · {sentCount} odeslaných e-mailů
          </p>
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="mt-12 rounded-xl border bg-card p-12 text-center shadow-sm">
          <Eye className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            Žádné záznamy
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Záznamy se vytváří automaticky, když přihlášený uživatel prohlíží
            produkt bez přidání do košíku.
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
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Produkt
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Cena
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    E-mail odeslán
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Stav
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Zaznamenáno
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b last:border-0 transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {record.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/products/${record.productId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {record.productName}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        {record.productBrand && (
                          <span>{record.productBrand}</span>
                        )}
                        {record.productSize && (
                          <span>vel. {record.productSize}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatPrice(record.productPrice)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {record.sentAt ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400"
                          title={formatDate(record.sentAt)}
                        >
                          <Check className="size-3.5" />
                          {formatDate(record.sentAt)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3.5" />
                          Čeká
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[record.status] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {STATUS_LABELS[record.status] ?? record.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(record.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Suspense fallback={<PaginationSkeleton />}>
        <Pagination
          totalItems={totalCount}
          perPage={ADMIN_BROWSE_PER_PAGE}
          basePath="/admin/browse-abandonment"
        />
      </Suspense>
    </>
  );
}
