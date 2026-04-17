import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronRight, Package, ShoppingBag, User } from "lucide-react";
import { OrderStatusBadge } from "./order-status-badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Můj účet — Janička",
};

export default async function AccountDashboardPage() {
  await connection();
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account");
  }

  const db = await getDb();
  const customer = await db.customer.findUnique({
    where: { id: session.user.id },
    select: { id: true, firstName: true },
  });
  if (!customer) redirect("/login");

  const [recentOrders, totalCount] = await Promise.all([
    db.order.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        accessToken: true,
      },
    }),
    db.order.count({ where: { customerId: customer.id } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-gradient-to-br from-champagne-light/40 via-card to-card p-6 shadow-sm">
        <h2 className="font-heading text-xl font-semibold">
          Ahoj, {customer.firstName}!
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalCount === 0
            ? "Zatím tu nemáš žádné objednávky. Mrkni do katalogu!"
            : `Máš u nás ${totalCount} ${ordersWord(totalCount)}.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DashCard
          href="/account/orders"
          icon={Package}
          iconClass="bg-sage-light text-sage-dark"
          title="Objednávky"
          description="Historie, stav a sledování zásilek"
        />
        <DashCard
          href="/account/profile"
          icon={User}
          iconClass="bg-champagne text-champagne-dark"
          title="Profil"
          description="Kontaktní údaje a doručovací adresa"
        />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold">
            Poslední objednávky
          </h3>
          {totalCount > 0 && (
            <Link
              href="/account/orders"
              className="text-sm font-medium text-primary hover:underline"
            >
              Všechny →
            </Link>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
            <ShoppingBag className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Ještě jsi nic neobjednala.
            </p>
            <Button render={<Link href="/products" />} className="mt-4">
              Do katalogu
              <ArrowRight data-icon="inline-end" className="size-4" />
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {recentOrders.map((o) => (
              <li
                key={o.id}
                className="rounded-xl border bg-card shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/30"
              >
                <Link
                  href={`/account/orders/${o.orderNumber}`}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(o.createdAt)}
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
      </section>
    </div>
  );
}

function ordersWord(n: number) {
  if (n === 1) return "objednávku";
  if (n >= 2 && n <= 4) return "objednávky";
  return "objednávek";
}

function DashCard({
  href,
  icon: Icon,
  title,
  description,
  iconClass,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  iconClass?: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
    >
      <div className="flex items-start gap-3">
        <div className={cn("rounded-lg p-2", iconClass ?? "bg-muted text-foreground")}>
          <Icon className="size-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
