import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight, Package } from "lucide-react";
import { OrderStatusBadge } from "../order-status-badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moje objednávky — Janička",
};

export default async function AccountOrdersPage() {
  await connection();
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account/orders");
  }

  const db = await getDb();
  const orders = await db.order.findMany({
    where: { customerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true,
      items: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-xl font-semibold">Moje objednávky</h2>

      {orders.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <Package className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Zatím zde nic není.
          </p>
          <Button render={<Link href="/products" />} className="mt-4">
            Prohlédnout katalog
            <ArrowRight data-icon="inline-end" className="size-4" />
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li
              key={o.id}
              className="rounded-xl border bg-card shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/30"
            >
              <Link
                href={`/account/orders/${o.orderNumber}`}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(o.createdAt)} · {o.items.length}{" "}
                    {o.items.length === 1 ? "položka" : o.items.length < 5 ? "položky" : "položek"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={o.status} />
                  <span className="whitespace-nowrap font-semibold">
                    {formatPrice(o.total)}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
