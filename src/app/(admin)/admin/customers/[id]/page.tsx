import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { connection } from "next/server";

import { formatPrice, formatDate } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  ShoppingCart,
  TrendingUp,
  Package,
  Send,
} from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id },
    select: { firstName: true, lastName: true },
  });
  return {
    title: customer
      ? `${customer.firstName} ${customer.lastName} — Zákazník`
      : "Zákazník",
  };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const db = await getDb();

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            select: {
              id: true,
              name: true,
              price: true,
              size: true,
              color: true,
            },
          },
        },
      },
    },
  });

  if (!customer) notFound();

  const emailHistory: {
    label: string;
    sentAt: Date;
    orderNumber?: string;
    orderId?: string;
  }[] = [];
  if (customer.winBackSentAt) {
    emailHistory.push({
      label: "Win-back (návrat zákazníka)",
      sentAt: customer.winBackSentAt,
    });
  }
  for (const o of customer.orders) {
    if (o.reviewEmailSentAt) {
      emailHistory.push({
        label: "Žádost o recenzi",
        sentAt: o.reviewEmailSentAt,
        orderNumber: o.orderNumber,
        orderId: o.id,
      });
    }
    if (o.deliveryCheckEmailSentAt) {
      emailHistory.push({
        label: "Ověření doručení",
        sentAt: o.deliveryCheckEmailSentAt,
        orderNumber: o.orderNumber,
        orderId: o.id,
      });
    }
    if (o.crossSellEmailSentAt) {
      emailHistory.push({
        label: "Cross-sell (T+14 dní)",
        sentAt: o.crossSellEmailSentAt,
        orderNumber: o.orderNumber,
        orderId: o.id,
      });
    }
  }
  emailHistory.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

  const validOrders = customer.orders.filter((o) => o.status !== "cancelled");
  const totalSpent = validOrders.reduce((sum, o) => sum + o.total, 0);
  const avgOrderValue =
    validOrders.length > 0 ? totalSpent / validOrders.length : 0;
  const totalItems = validOrders.reduce((sum, o) => sum + o.items.length, 0);

  const stats = [
    {
      label: "Objednávky",
      value: customer.orders.length.toString(),
      icon: ShoppingCart,
      color: "text-primary bg-primary/10",
    },
    {
      label: "Utraceno celkem",
      value: formatPrice(totalSpent),
      icon: TrendingUp,
      color: "text-emerald-600 bg-emerald-100",
    },
    {
      label: "Průměrná objednávka",
      value: formatPrice(avgOrderValue),
      icon: TrendingUp,
      color: "text-sky-600 bg-sky-100",
    },
    {
      label: "Zakoupených kusů",
      value: totalItems.toString(),
      icon: Package,
      color: "text-violet-600 bg-violet-100",
    },
  ];

  return (
    <>
      {/* Back link */}
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zpět na zákazníky
      </Link>

      {/* Customer header */}
      <div className="mt-4 rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          {customer.firstName} {customer.lastName}
        </h1>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Mail className="size-4" />
            {customer.email}
          </span>
          {customer.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-4" />
              {customer.phone}
            </span>
          )}
          {customer.street && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" />
              {customer.street}, {customer.zip} {customer.city}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Zákazník od {formatDate(customer.createdAt)}
        </p>
      </div>

      {/* Stats */}
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

      {/* Email history */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Send className="size-5 text-muted-foreground" />
          Historie marketingových emailů
        </h2>

        {emailHistory.length === 0 ? (
          <div className="mt-4 rounded-xl border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Zákazníkovi zatím nebyl odeslán žádný lifecycle email.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
            <ul className="divide-y">
              {emailHistory.map((entry, idx) => (
                <li
                  key={`${entry.label}-${entry.orderId ?? "customer"}-${idx}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">
                      {entry.label}
                    </span>
                    {entry.orderNumber && entry.orderId && (
                      <Link
                        href={`/admin/orders/${entry.orderId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {entry.orderNumber}
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(entry.sentAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Order history */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Historie objednávek
        </h2>

        {customer.orders.length === 0 ? (
          <div className="mt-4 rounded-xl border bg-card p-8 text-center shadow-sm">
            <ShoppingCart className="mx-auto size-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">
              Zatím žádné objednávky.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {customer.orders.map((order) => {
              const statusLabel =
                ORDER_STATUS_LABELS[order.status] ?? order.status;
              const statusColor =
                ORDER_STATUS_COLORS[order.status] ??
                "bg-muted text-muted-foreground";

              return (
                <div
                  key={order.id}
                  className="rounded-xl border bg-card shadow-sm"
                >
                  {/* Order header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {order.paymentMethod && (
                        <span>
                          {PAYMENT_METHOD_LABELS[order.paymentMethod] ??
                            order.paymentMethod}
                        </span>
                      )}
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                  </div>

                  {/* Order items */}
                  <div className="px-5 py-3">
                    <ul className="space-y-2">
                      {order.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div>
                            <span className="text-foreground">{item.name}</span>
                            {(item.size || item.color) && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {item.size}
                                {item.size && item.color ? " · " : ""}
                                {item.color}
                              </span>
                            )}
                          </div>
                          <span className="font-medium">
                            {formatPrice(item.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Order total */}
                  <div className="flex items-center justify-between border-t px-5 py-3">
                    <span className="text-sm text-muted-foreground">
                      {order.items.length}{" "}
                      {order.items.length === 1
                        ? "položka"
                        : order.items.length >= 2 && order.items.length <= 4
                          ? "položky"
                          : "položek"}
                    </span>
                    <span className="text-lg font-bold text-foreground">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
