import { Suspense } from "react";
import Link from "next/link";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { getDb } from "@/lib/db";

import { OrderSearch } from "@/components/admin/order-search";
import { OrderExportButton } from "@/components/admin/order-export-button";
import { AccountingExportButton } from "@/components/admin/accounting-export-button";
import { OrdersTable, type OrderRow } from "./orders-table";
import { Skeleton } from "@/components/ui/skeleton";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

export const metadata: Metadata = {
  title: "Objednávky",
};

const VALID_STATUSES = ["pending", "confirmed", "paid", "shipped", "delivered", "cancelled"];

async function getOrdersPageData(status: string, query: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("admin-orders");

  const db = await getDb();
  const where: Prisma.OrderWhereInput = {};
  if (status && status !== "all" && VALID_STATUSES.includes(status)) {
    where.status = status;
  }
  if (query) {
    where.OR = [
      { orderNumber: { contains: query } },
      { customer: { firstName: { contains: query } } },
      { customer: { lastName: { contains: query } } },
      { customer: { email: { contains: query } } },
    ];
  }

  return db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      shippingMethod: true,
      packetId: true,
      total: true,
      createdAt: true,
      expectedDeliveryDate: true,
      customer: {
        select: { firstName: true, lastName: true, email: true },
      },
      _count: { select: { items: true } },
    },
  });
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const orders = await getOrdersPageData(params.status ?? "", query);

  // Compute delivery deadline urgency for active orders + shape for client table
  const now = new Date();
  const orderRows: OrderRow[] = orders.map((order) => {
    let deadlineUrgency: OrderRow["deadlineUrgency"] = null;
    if (
      order.expectedDeliveryDate &&
      order.status !== "delivered" &&
      order.status !== "cancelled"
    ) {
      const daysRemaining = Math.ceil(
        (order.expectedDeliveryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (daysRemaining < 0) deadlineUrgency = "overdue";
      else if (daysRemaining <= 5) deadlineUrgency = "urgent";
      else if (daysRemaining <= 10) deadlineUrgency = "approaching";
      else deadlineUrgency = "ok";
    }
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      shippingMethod: order.shippingMethod,
      packetId: order.packetId,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      itemCount: order._count.items,
      customerFirstName: order.customer.firstName,
      customerLastName: order.customer.lastName,
      customerEmail: order.customer.email,
      deadlineUrgency,
    };
  });

  const statusFilters = [
    { value: "all", label: "Všechny" },
    { value: "pending", label: "Čeká" },
    { value: "confirmed", label: "Potvrzeno" },
    { value: "paid", label: "Zaplaceno" },
    { value: "shipped", label: "Odesláno" },
    { value: "delivered", label: "Doručeno" },
    { value: "cancelled", label: "Zrušeno" },
  ];

  const activeStatus = params.status || "all";
  const isFiltered = query || (params.status && params.status !== "all");

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Objednávky
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orderRows.length}{" "}
            {orderRows.length === 1
              ? "objednávka"
              : orderRows.length >= 2 && orderRows.length <= 4
                ? "objednávky"
                : "objednávek"}
            {isFiltered && " (filtrováno)"}
          </p>
        </div>
        <div className="flex gap-2">
          <AccountingExportButton />
          <Suspense fallback={<Skeleton className="h-9 w-24 rounded-lg" />}>
            <OrderExportButton />
          </Suspense>
        </div>
      </div>

      {/* Search */}
      <div className="mt-4 max-w-md">
        <Suspense fallback={<Skeleton className="h-9 w-full rounded-lg" />}>
          <OrderSearch />
        </Suspense>
      </div>

      {/* Status filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        {statusFilters.map((filter) => {
          const href = new URLSearchParams();
          if (filter.value !== "all") href.set("status", filter.value);
          if (query) href.set("q", query);
          const hrefStr = href.toString();
          return (
            <Link
              key={filter.value}
              href={`/admin/orders${hrefStr ? `?${hrefStr}` : ""}`}
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

      <OrdersTable orders={orderRows} />
    </>
  );
}
