import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
import { formatPrice, formatDate } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  CONDITION_LABELS,
  PAYMENT_METHOD_LABELS,
  SHIPPING_METHOD_LABELS,
} from "@/lib/constants";
import { ArrowLeft } from "lucide-react";
import { OrderStatusSelect } from "./order-status-select";
import { TrackingNumberForm } from "./tracking-number-form";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { orderNumber: true },
  });
  return {
    title: order ? `Objednávka ${order.orderNumber}` : "Objednávka nenalezena",
  };
}

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: {
        include: {
          product: {
            select: { slug: true, condition: true, brand: true },
          },
        },
      },
    },
  });

  if (!order) notFound();

  return (
    <>
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zpět na objednávky
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vytvořena {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${ORDER_STATUS_COLORS[order.status] ?? "bg-muted text-muted-foreground"}`}
          >
            {ORDER_STATUS_LABELS[order.status] ?? order.status}
          </span>
          <OrderStatusSelect
            orderId={order.id}
            currentStatus={order.status}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Order items */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Položky ({order.items.length})
              </h2>
            </div>
            <div className="divide-y">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {item.size && <span>Vel. {item.size}</span>}
                      {item.color && <span>Barva: {item.color}</span>}
                      {item.product.brand && (
                        <span>{item.product.brand}</span>
                      )}
                      {item.product.condition && (
                        <span>
                          {CONDITION_LABELS[item.product.condition] ??
                            item.product.condition}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/admin/products/${item.productId}/edit`}
                      className="mt-1 inline-block text-xs text-primary hover:underline"
                    >
                      Zobrazit produkt
                    </Link>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="font-medium">{formatPrice(item.price)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity}×
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t px-5 py-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Mezisoučet</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-muted-foreground">Doprava</span>
                <span>
                  {order.shipping === 0
                    ? "Zdarma"
                    : formatPrice(order.shipping)}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
                <span>Celkem</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: customer + shipping */}
        <div className="space-y-6">
          {/* Customer info */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold text-foreground">
              Zákazník
            </h2>
            <div className="mt-3 space-y-1 text-sm">
              <p className="font-medium text-foreground">
                {order.customer.firstName} {order.customer.lastName}
              </p>
              <p className="text-muted-foreground">{order.customer.email}</p>
              {order.customer.phone && (
                <p className="text-muted-foreground">{order.customer.phone}</p>
              )}
            </div>
          </div>

          {/* Shipping */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold text-foreground">
              Doprava
            </h2>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                {SHIPPING_METHOD_LABELS[order.shippingMethod ?? ""] ??
                  order.shippingMethod ??
                  "Standardní doručení"}
              </p>
              {order.shippingMethod === "packeta_pickup" && order.shippingPointId ? (
                <>
                  <p>{order.shippingStreet}</p>
                  <p className="font-mono text-xs">
                    Výdejní místo #{order.shippingPointId}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">
                    {order.shippingName}
                  </p>
                  <p>{order.shippingStreet}</p>
                  <p>
                    {order.shippingZip} {order.shippingCity}
                  </p>
                  <p>{order.shippingCountry}</p>
                </>
              )}
              {order.shipping > 0 && (
                <p className="mt-2 font-medium text-foreground">
                  Cena dopravy: {formatPrice(order.shipping)}
                </p>
              )}
            </div>
            <div className="mt-4 border-t pt-4">
              <TrackingNumberForm
                orderId={order.id}
                currentTrackingNumber={order.trackingNumber}
              />
            </div>
          </div>

          {/* Payment info */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold text-foreground">
              Platba
            </h2>
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Způsob: </span>
                {PAYMENT_METHOD_LABELS[order.paymentMethod ?? ""] ??
                  order.paymentMethod ??
                  "Neurčen"}
              </p>
              {order.paymentId && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">ID transakce: </span>
                  <span className="font-mono text-xs">{order.paymentId}</span>
                </p>
              )}
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Stav: </span>
                {order.status === "paid" ||
                order.status === "shipped" ||
                order.status === "delivered"
                  ? "Zaplaceno"
                  : order.status === "cancelled"
                    ? "Zrušeno"
                    : order.paymentMethod === "cod"
                      ? "Dobírka — platba při převzetí"
                      : "Čeká na platbu"}
              </p>
            </div>
          </div>

          {/* Note */}
          {order.note && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Poznámka
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{order.note}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
