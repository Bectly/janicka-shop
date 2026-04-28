import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { connection } from "next/server";

import { formatPrice, formatDate } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  CONDITION_LABELS,
  PAYMENT_METHOD_LABELS,
  SHIPPING_METHOD_LABELS,
} from "@/lib/constants";
import { ArrowLeft, Clock, AlertTriangle, CheckCircle2, Mail, PenSquare } from "lucide-react";
import { OrderStatusSelect } from "./order-status-select";
import { TrackingNumberForm } from "./tracking-number-form";
import { PacketaSection } from "./packeta-section";
import { InvoiceSection } from "./invoice-section";
import { CreateReturnForm } from "./create-return-form";
import { InternalNoteEditor } from "./internal-note-editor";
import {
  RETURN_STATUS_LABELS,
  RETURN_STATUS_COLORS,
  RETURN_REASON_LABELS,
} from "@/lib/constants";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const db = await getDb();
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    select: { orderNumber: true },
  });
  return {
    title: order ? `Objednávka ${order.orderNumber}` : "Objednávka nenalezena",
  };
}

export default async function AdminOrderDetailPage({ params }: Props) {
  await connection();
  const db = await getDb();
  const { id } = await params;

  const order = await db.order.findUnique({
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
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, number: true, issuedAt: true, totalAmount: true },
      },
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
            {order.shippedAt && (
              <> · Odesláno {formatDate(order.shippedAt)}</>
            )}
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
              <Link
                href={`/admin/customers/${order.customer.id}`}
                className="font-medium text-foreground hover:text-primary hover:underline"
              >
                {order.customer.firstName} {order.customer.lastName}
              </Link>
              <p className="text-muted-foreground">{order.customer.email}</p>
              {order.customer.phone && (
                <p className="text-muted-foreground">{order.customer.phone}</p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
              <Link
                href={`/admin/mailbox?q=${encodeURIComponent(order.customer.email)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Mail className="size-3.5" />
                Zobrazit konverzace
              </Link>
              <Link
                href={`/admin/mailbox/compose?to=${encodeURIComponent(order.customer.email)}`}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PenSquare className="size-3.5" />
                Napsat e-mail
              </Link>
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
            {order.shippingMethod?.startsWith("packeta") && order.shippingPointId && (
              <PacketaSection
                orderId={order.id}
                packetId={order.packetId}
              />
            )}
          </div>

          {/* Delivery deadline — Czech law §2159 NOZ: 30 days */}
          {order.expectedDeliveryDate &&
            order.status !== "delivered" &&
            order.status !== "cancelled" && (
              <DeliveryDeadlineCard
                expectedDeliveryDate={order.expectedDeliveryDate}
                status={order.status}
              />
            )}
          {order.status === "delivered" && order.expectedDeliveryDate && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Termín doručení
              </h2>
              <div className="mt-3 flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="size-4" />
                <span>Doručeno v termínu</span>
              </div>
            </div>
          )}

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

          {/* Invoice */}
          <InvoiceSection
            orderId={order.id}
            existingInvoice={order.invoices[0] ?? null}
          />

          {/* Email status */}
          {order.shippedAt && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Emaily
              </h2>
              <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Odeslání: </span>
                  {order.shippedAt ? formatDate(order.shippedAt) : "—"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Žádost o recenzi: </span>
                  {order.reviewEmailSentAt ? formatDate(order.reviewEmailSentAt) : "Čeká (7 dní po odeslání)"}
                </p>
              </div>
            </div>
          )}

          {/* Returns */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold text-foreground">
              Vratky
            </h2>
            {order.returns.length > 0 ? (
              <div className="mt-3 space-y-3">
                {order.returns.map((ret) => (
                  <div
                    key={ret.id}
                    className="flex items-center justify-between rounded-lg border bg-background p-3"
                  >
                    <div>
                      <Link
                        href={`/admin/returns/${ret.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {ret.returnNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {RETURN_REASON_LABELS[ret.reason] ?? ret.reason}
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${RETURN_STATUS_COLORS[ret.status] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {RETURN_STATUS_LABELS[ret.status] ?? ret.status}
                      </span>
                      <p className="mt-1 text-xs font-medium">
                        {formatPrice(ret.refundAmount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Žádné vratky
              </p>
            )}
            <div className="mt-4 border-t pt-4">
              <CreateReturnForm
                orderId={order.id}
                orderTotal={order.total}
                items={order.items.map((i) => ({
                  id: i.id,
                  name: i.name,
                  price: i.price,
                  size: i.size,
                  color: i.color,
                }))}
              />
            </div>
          </div>

          {/* Customer note (from checkout) */}
          {order.note && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Poznámka od zákaznice
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{order.note}</p>
            </div>
          )}

          {/* Internal admin note */}
          <InternalNoteEditor
            orderId={order.id}
            initialValue={order.internalNote}
          />
        </div>
      </div>
    </>
  );
}

/** Delivery deadline card with visual urgency levels */
function DeliveryDeadlineCard({
  expectedDeliveryDate,
  status,
}: {
  expectedDeliveryDate: Date;
  status: string;
}) {
  const now = new Date();
  const daysRemaining = Math.ceil(
    (expectedDeliveryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );
  const isOverdue = daysRemaining < 0;
  const isUrgent = daysRemaining >= 0 && daysRemaining <= 5;
  const isApproaching = daysRemaining > 5 && daysRemaining <= 10;

  const dateStr = new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  
          timeZone: "Europe/Prague",
        }).format(expectedDeliveryDate);

  let borderColor = "border-border";
  let icon = <Clock className="size-4 text-muted-foreground" />;
  let statusText = `${daysRemaining} dní zbývá`;
  let statusColor = "text-muted-foreground";

  if (isOverdue) {
    borderColor = "border-red-300";
    icon = <AlertTriangle className="size-4 text-red-600" />;
    statusText = `Po termínu (${Math.abs(daysRemaining)} dní)`;
    statusColor = "text-red-600 font-medium";
  } else if (isUrgent) {
    borderColor = "border-amber-300";
    icon = <AlertTriangle className="size-4 text-amber-600" />;
    statusText =
      daysRemaining === 0
        ? "Dnes je termín!"
        : daysRemaining === 1
          ? "Zbývá 1 den"
          : `Zbývá ${daysRemaining} dní`;
    statusColor = "text-amber-600 font-medium";
  } else if (isApproaching) {
    borderColor = "border-sky-200";
    icon = <Clock className="size-4 text-sky-600" />;
    statusText = `${daysRemaining} dní zbývá`;
    statusColor = "text-sky-600";
  }

  const notShipped = status !== "shipped";

  return (
    <div className={`rounded-xl border ${borderColor} bg-card p-5 shadow-sm`}>
      <h2 className="font-heading text-base font-semibold text-foreground">
        Termín doručení
      </h2>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          {icon}
          <span className={statusColor}>{statusText}</span>
        </div>
        <p className="text-muted-foreground">
          Doručit do: <span className="font-medium text-foreground">{dateStr}</span>
        </p>
        {notShipped && (isUrgent || isOverdue) && (
          <p className="text-xs text-red-600">
            Objednávka dosud nebyla odeslána!
          </p>
        )}
      </div>
    </div>
  );
}
