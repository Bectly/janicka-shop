import { getDb } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import { connection } from "next/server";
import { ShoppingCart, Check, Clock } from "lucide-react";
import { Suspense } from "react";
import { Pagination, PaginationSkeleton } from "@/components/shop/pagination";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Opuštěné košíky",
};

const ADMIN_ABANDONED_PER_PAGE = 25;

const STATUS_LABELS: Record<string, string> = {
  pending: "Čeká",
  recovered: "Obnoveno",
  expired: "Expirováno",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  recovered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

function EmailBadge({ sentAt, label }: { sentAt: Date | null; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        sentAt
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-500"
      }`}
      title={sentAt ? formatDate(sentAt) : "Neodesláno"}
    >
      {sentAt ? <Check className="size-3" /> : <Clock className="size-3" />}
      {label}
    </span>
  );
}

export default async function AdminAbandonedCartsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1") || 1);

  await connection();
  const db = await getDb();

  const [totalCount, carts] = await Promise.all([
    db.abandonedCart.count(),
    db.abandonedCart.findMany({
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ADMIN_ABANDONED_PER_PAGE,
      take: ADMIN_ABANDONED_PER_PAGE,
    }),
  ]);

  const recoveredCount = await db.abandonedCart.count({
    where: { status: "recovered" },
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Opuštěné košíky
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount}{" "}
            {totalCount === 1
              ? "košík"
              : totalCount >= 2 && totalCount <= 4
                ? "košíky"
                : "košíků"}{" "}
            celkem · {recoveredCount} obnovených
          </p>
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="mt-12 rounded-xl border bg-card p-12 text-center shadow-sm">
          <ShoppingCart className="mx-auto size-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">
            Žádné opuštěné košíky
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Opuštěné košíky se zaznamenávají automaticky při nedokončení
            objednávky.
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
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Položky
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Hodnota
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    E-maily
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Stav
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Opuštěno
                  </th>
                </tr>
              </thead>
              <tbody>
                {carts.map((cart) => {
                  let items: { name?: string; productId?: string }[] = [];
                  try {
                    items = JSON.parse(cart.cartItems);
                  } catch {
                    // invalid JSON
                  }

                  return (
                    <tr
                      key={cart.id}
                      className="border-b last:border-0 transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">
                          {cart.email}
                        </p>
                        {cart.customerName && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {cart.customerName}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-lg font-bold text-foreground">
                          {items.length}
                        </span>
                        <div className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">
                          {items
                            .slice(0, 3)
                            .map((i) => i.name ?? "?")
                            .join(", ")}
                          {items.length > 3 && ` +${items.length - 3}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-foreground">
                        {formatPrice(cart.cartTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <EmailBadge
                            sentAt={cart.email1SentAt}
                            label="1."
                          />
                          <EmailBadge
                            sentAt={cart.email2SentAt}
                            label="2."
                          />
                          <EmailBadge
                            sentAt={cart.email3SentAt}
                            label="3."
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[cart.status] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {STATUS_LABELS[cart.status] ?? cart.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(cart.createdAt)}
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
          perPage={ADMIN_ABANDONED_PER_PAGE}
          basePath="/admin/abandoned-carts"
        />
      </Suspense>
    </>
  );
}
