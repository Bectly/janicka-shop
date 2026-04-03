import { prisma } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from "@/lib/constants";
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  DollarSign,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Přehled",
};

export default async function AdminDashboardPage() {
  const [
    totalProducts,
    activeProducts,
    soldProducts,
    totalOrders,
    totalCustomers,
    recentProducts,
    recentOrders,
    allOrders,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { active: true, sold: false } }),
    prisma.product.count({ where: { sold: true } }),
    prisma.order.count(),
    prisma.customer.count(),
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { category: { select: { name: true } } },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.order.findMany({
      select: { total: true, status: true },
    }),
  ]);

  const totalRevenue = allOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);

  const ordersByStatus = allOrders.reduce<Record<string, number>>(
    (acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    },
    {},
  );

  const stats = [
    {
      label: "Tržby celkem",
      value: formatPrice(totalRevenue),
      icon: DollarSign,
      color: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "Aktivní (k prodeji)",
      value: activeProducts.toString(),
      icon: TrendingUp,
      color: "text-sky-600 bg-sky-100",
    },
    {
      label: "Prodáno",
      value: soldProducts.toString(),
      icon: CheckCircle,
      color: "text-violet-600 bg-violet-100",
    },
    {
      label: "Produkty celkem",
      value: totalProducts.toString(),
      icon: Package,
      color: "text-slate-600 bg-slate-100",
    },
    {
      label: "Objednávky",
      value: totalOrders.toString(),
      icon: ShoppingCart,
      color: "text-primary bg-primary/10",
    },
    {
      label: "Zákazníci",
      value: totalCustomers.toString(),
      icon: Users,
      color: "text-amber-600 bg-amber-100",
    },
  ];

  return (
    <>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Přehled
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vítej zpět, Janičko!
      </p>

      {/* Stats grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl border bg-card p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${stat.color}`}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Order status breakdown */}
      {totalOrders > 0 && (
        <section className="mt-8">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Stav objednávek
          </h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => {
              const count = ordersByStatus[status] || 0;
              if (count === 0) return null;
              const colorClass =
                ORDER_STATUS_COLORS[status] || "bg-muted text-muted-foreground";
              return (
                <Link
                  key={status}
                  href={`/admin/orders?status=${status}`}
                  className="inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 shadow-sm transition-colors hover:bg-muted/50"
                >
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
                  >
                    {label}
                  </span>
                  <span className="text-lg font-bold text-foreground">
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Recent orders */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Poslední objednávky
            </h2>
            <Link
              href="/admin/orders"
              className="text-sm text-primary hover:underline"
            >
              Zobrazit vše
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
            {recentOrders.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Zatím žádné objednávky.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Objednávka
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Zákazník
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Celkem
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      Stav
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => {
                    const statusLabel =
                      ORDER_STATUS_LABELS[order.status] || order.status;
                    const statusColor =
                      ORDER_STATUS_COLORS[order.status] ||
                      "bg-muted text-muted-foreground";
                    return (
                      <tr key={order.id} className="border-b last:border-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(order.createdAt)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {order.customer.firstName} {order.customer.lastName}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatPrice(order.total)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Recent products */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Naposledy přidané
            </h2>
            <Link
              href="/admin/products"
              className="text-sm text-primary hover:underline"
            >
              Zobrazit vše
            </Link>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Produkt
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Kategorie
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Cena
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Stav
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentProducts.map((product) => (
                  <tr key={product.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {product.category.name}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatPrice(product.price)}
                    </td>
                    <td className="px-4 py-3">
                      {product.sold ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          Prodáno
                        </span>
                      ) : product.active ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          Aktivní
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Skryto
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
