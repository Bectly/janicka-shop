import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { Package, ShoppingCart, Users, TrendingUp } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Přehled",
};

export default async function AdminDashboardPage() {
  const [
    totalProducts,
    activeProducts,
    totalOrders,
    totalCustomers,
    recentProducts,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { active: true, sold: false } }),
    prisma.order.count(),
    prisma.customer.count(),
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { category: { select: { name: true } } },
    }),
  ]);

  const stats = [
    {
      label: "Produkty celkem",
      value: totalProducts,
      icon: Package,
      color: "text-sky-600 bg-sky-100",
    },
    {
      label: "Aktivní (k prodeji)",
      value: activeProducts,
      icon: TrendingUp,
      color: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "Objednávky",
      value: totalOrders,
      icon: ShoppingCart,
      color: "text-primary bg-primary/10",
    },
    {
      label: "Zákazníci",
      value: totalCustomers,
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
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Recent products */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Naposledy přidané
        </h2>
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
    </>
  );
}
