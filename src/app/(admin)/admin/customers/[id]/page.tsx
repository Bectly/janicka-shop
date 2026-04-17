import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getDb } from "@/lib/db";
import { connection } from "next/server";
import { CustomerInternalNoteEditor } from "../internal-note-editor";
import { CustomerTagEditor } from "../tag-editor";
import { AdminActionsPanel } from "./admin-actions-panel";
import { CustomerProfileEditor } from "./profile-editor";
import { CustomerActivityFeed } from "@/components/shop/customer-activity-feed";

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
  ShoppingCart,
  TrendingUp,
  Package,
  Send,
  Heart,
  RotateCcw,
  Shield,
  Ban,
  Lock,
  AlertTriangle,
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

  const [customer, auditLogs] = await Promise.all([
    db.customer.findUnique({
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
      addresses: { orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] },
      returns: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          returnNumber: true,
          status: true,
          reason: true,
          refundAmount: true,
          createdAt: true,
        },
      },
      wishlist: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: {
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              price: true,
              images: true,
              sold: true,
            },
          },
        },
      },
      _count: { select: { wishlist: true } },
    },
    }),
    db.customerAuditLog.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        action: true,
        ip: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  if (!customer) notFound();

  const now = Date.now();
  const isLocked =
    !!customer.lockedUntil && customer.lockedUntil.getTime() > now;
  const isDisabled = customer.disabled;
  const isDeleted = !!customer.deletedAt;
  const daysSinceLastOrder =
    customer.orders[0] !== undefined
      ? Math.floor(
          (now - customer.orders[0].createdAt.getTime()) / (1000 * 60 * 60 * 24),
        )
      : null;
  const firstOrderAt =
    customer.orders.length > 0
      ? customer.orders[customer.orders.length - 1].createdAt
      : null;
  const lockedMinutes = customer.lockedUntil
    ? Math.max(0, Math.ceil((customer.lockedUntil.getTime() - now) / 60000))
    : 0;

  let customerTags: string[] = [];
  try {
    const parsed = JSON.parse(customer.tags);
    if (Array.isArray(parsed)) {
      customerTags = parsed.filter((t): t is string => typeof t === "string");
    }
  } catch {
    customerTags = [];
  }

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
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
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Zákaznice od {formatDate(customer.createdAt)}
              {customer.lastLoginAt
                ? ` · Poslední přihlášení ${formatDate(customer.lastLoginAt)}`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDeleted ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Ban className="size-3.5" />
                Smazán (GDPR)
              </span>
            ) : isDisabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                <Ban className="size-3.5" />
                Zablokovaný
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <Shield className="size-3.5" />
                Aktivní
              </span>
            )}

            {isLocked && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">
                <Lock className="size-3.5" />
                Uzamčeno {lockedMinutes} min
              </span>
            )}

            {customer.emailVerified ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                Email ověřen
              </span>
            ) : customer.password ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Email neověřen
              </span>
            ) : null}

            {customer.loginAttempts > 0 && !isLocked && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <AlertTriangle className="size-3.5" />
                {customer.loginAttempts} neúspěch
                {customer.loginAttempts === 1 ? "" : customer.loginAttempts >= 2 && customer.loginAttempts <= 4 ? "y" : "ů"}
              </span>
            )}
          </div>
        </div>
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

      {/* Quick extra stats */}
      {(firstOrderAt || daysSinceLastOrder !== null) && (
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {firstOrderAt && (
            <span>První objednávka: {formatDate(firstOrderAt)}</span>
          )}
          {daysSinceLastOrder !== null && (
            <span>
              Poslední objednávka před {daysSinceLastOrder}{" "}
              {daysSinceLastOrder === 1
                ? "dnem"
                : "dny"}
            </span>
          )}
        </div>
      )}

      {/* Profile + Admin actions */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <CustomerProfileEditor
          customerId={customer.id}
          initial={{
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
            street: customer.street,
            city: customer.city,
            zip: customer.zip,
            country: customer.country,
          }}
        />
        <AdminActionsPanel
          customerId={customer.id}
          isLocked={isLocked}
          isDisabled={isDisabled}
          isDeleted={isDeleted}
          hasPassword={!!customer.password}
        />
      </section>

      {/* Admin-only: internal note + tags */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <CustomerInternalNoteEditor
          customerId={customer.id}
          initialValue={customer.internalNote}
        />
        <CustomerTagEditor
          customerId={customer.id}
          initialTags={customerTags}
        />
      </section>

      {/* Addresses */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Uložené adresy ({customer.addresses.length})
        </h2>
        {customer.addresses.length === 0 ? (
          <div className="mt-4 rounded-xl border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Zákaznice zatím nemá uložené žádné adresy.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {customer.addresses.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{a.label}</p>
                  {a.isDefault && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Výchozí
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-foreground">
                  {a.firstName} {a.lastName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {a.street}, {a.zip} {a.city}
                  {a.country && a.country !== "CZ" ? ` (${a.country})` : ""}
                </p>
                {a.phone && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.phone}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Returns */}
      {customer.returns.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <RotateCcw className="size-5 text-muted-foreground" />
            Vratky ({customer.returns.length})
          </h2>
          <div className="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
            <ul className="divide-y">
              {customer.returns.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <div>
                    <Link
                      href={`/admin/returns/${r.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.returnNumber}
                    </Link>
                    <span className="ml-3 text-xs text-muted-foreground">
                      {r.reason}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {r.status}
                    </span>
                    <span className="font-medium">
                      {formatPrice(r.refundAmount)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Wishlist */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Heart className="size-5 text-muted-foreground" />
          Oblíbené ({customer._count.wishlist})
        </h2>
        {customer._count.wishlist === 0 ? (
          <div className="mt-4 rounded-xl border bg-card p-6 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">
              Zákaznice zatím nemá nic v oblíbených.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {customer.wishlist.map((w) => {
              const images: string[] = (() => {
                try {
                  const parsed = JSON.parse(w.product.images);
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              })();
              const thumb = images[0];
              return (
                <Link
                  key={w.id}
                  href={`/admin/products/${w.product.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm hover:bg-muted/30"
                >
                  {thumb ? (
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
                      <Image
                        src={thumb}
                        alt={w.product.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="size-14 shrink-0 rounded-md bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {w.product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatPrice(w.product.price)}
                    </p>
                    {w.product.sold && (
                      <p className="mt-0.5 text-xs text-rose-600">
                        Prodáno
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

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

      {/* Audit log */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Shield className="size-5 text-muted-foreground" />
          Aktivita na účtu ({auditLogs.length})
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Posledních 50 událostí — přihlášení, změny profilu, admin akce. IP adresy jsou
          viditelné pouze adminovi.
        </p>
        <div className="mt-4">
          <CustomerActivityFeed entries={auditLogs} showIp />
        </div>
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
