import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Truck, Undo2, ExternalLink } from "lucide-react";
import { OrderStatusBadge } from "../../order-status-badge";
import type { Metadata } from "next";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "Platba kartou",
  bank_transfer: "Bankovní převod",
  cod: "Dobírka",
};

const SHIPPING_METHOD_LABELS: Record<string, string> = {
  packeta_pickup: "Zásilkovna — výdejní místo",
  packeta_home: "Zásilkovna — na adresu",
  czech_post: "Česká pošta",
};

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Objednávka ${orderNumber} — Janička` };
}

export default async function AccountOrderDetailPage({ params }: Props) {
  await connection();
  const session = await auth();
  if (!session?.user || session.user.role !== "customer") {
    redirect("/login?redirect=/account/orders");
  }

  const { orderNumber } = await params;
  const db = await getDb();
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });

  if (!order || order.customerId !== session.user.id) notFound();

  const deliveredAt =
    order.status === "delivered"
      ? order.updatedAt
      : order.status === "shipped" && order.shippedAt
        ? order.shippedAt
        : null;

  const withdrawalDeadline = deliveredAt
    ? new Date(deliveredAt.getTime() + 14 * 24 * 60 * 60 * 1000)
    : null;
  const withdrawalOpen =
    withdrawalDeadline !== null && withdrawalDeadline.getTime() > Date.now();

  const packetaTrackingUrl =
    order.packetId || order.trackingNumber
      ? `https://tracking.packeta.com/cs/?id=${encodeURIComponent(order.packetId ?? order.trackingNumber ?? "")}`
      : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Zpět na objednávky
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">
            Objednávka {order.orderNumber}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {packetaTrackingUrl && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="size-4 text-primary" />
            Sledování zásilky
          </h3>
          {order.trackingNumber && (
            <p className="mt-1 text-sm text-muted-foreground">
              Číslo zásilky: <strong>{order.trackingNumber}</strong>
            </p>
          )}
          <Button
            render={<a href={packetaTrackingUrl} target="_blank" rel="noopener noreferrer" />}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            Sledovat na Packeta
            <ExternalLink data-icon="inline-end" className="size-4" />
          </Button>
        </div>
      )}

      {withdrawalOpen && withdrawalDeadline && (
        <div className="rounded-xl border border-champagne-dark/30 bg-champagne-light/30 p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Undo2 className="size-4" />
            Odstoupení od smlouvy
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Do {formatDate(withdrawalDeadline)} máš právo odstoupit od smlouvy
            a zboží vrátit.
          </p>
          <Button
            render={<Link href={`/returns/withdrawal-form?order=${order.orderNumber}`} />}
            size="sm"
            variant="outline"
            className="mt-3"
          >
            Vrátit zboží
          </Button>
        </div>
      )}

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h3 className="font-heading text-base font-semibold">Položky</h3>
        <ul className="mt-3 divide-y">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.size}
                  {item.color && ` · ${item.color}`}
                </p>
              </div>
              <span className="whitespace-nowrap text-sm font-medium">
                {formatPrice(item.price)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mezisoučet</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Doprava</span>
            <span>
              {order.shipping === 0 ? "Zdarma" : formatPrice(order.shipping)}
            </span>
          </div>
          {order.referralDiscount > 0 && (
            <div className="flex justify-between text-sage-dark">
              <span>Sleva z doporučení</span>
              <span>-{formatPrice(order.referralDiscount)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
            <span>Celkem</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Způsob platby</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {PAYMENT_METHOD_LABELS[order.paymentMethod ?? ""] ??
              order.paymentMethod ??
              "—"}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold">Doprava</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {SHIPPING_METHOD_LABELS[order.shippingMethod ?? ""] ??
              order.shippingMethod ??
              "—"}
          </p>
          {order.shippingMethod === "packeta_pickup" && order.shippingPointId ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted/50 p-3">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {order.shippingStreet}
                </p>
                <p className="text-xs text-muted-foreground">
                  Výdejní místo #{order.shippingPointId}
                </p>
              </div>
            </div>
          ) : (
            (order.shippingName || order.shippingStreet) && (
              <p className="mt-2 text-sm text-muted-foreground">
                {order.shippingName}
                <br />
                {order.shippingStreet}
                <br />
                {order.shippingZip} {order.shippingCity}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}
