import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/format";
import {
  RETURN_STATUS_LABELS,
  RETURN_STATUS_COLORS,
  RETURN_REASON_LABELS,
  ORDER_STATUS_LABELS,
} from "@/lib/constants";
import { ArrowLeft } from "lucide-react";
import { ReturnStatusSelect } from "./return-status-select";
import { CreditNoteSection } from "./credit-note-section";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const db = await getDb();
  const { id } = await params;
  const ret = await db.return.findUnique({
    where: { id },
    select: { returnNumber: true },
  });
  return {
    title: ret ? `Vratka ${ret.returnNumber}` : "Vratka nenalezena",
  };
}

export default async function AdminReturnDetailPage({ params }: Props) {
  const db = await getDb();
  const { id } = await params;

  const ret = await db.return.findUnique({
    where: { id },
    include: {
      customer: true,
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          paymentMethod: true,
          createdAt: true,
          shippingStreet: true,
          shippingCity: true,
          shippingZip: true,
          shippingCountry: true,
          invoices: {
            orderBy: { createdAt: "desc" as const },
            take: 1,
            select: { id: true },
          },
        },
      },
      items: true,
      creditNotes: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: {
          id: true,
          number: true,
          invoiceNumber: true,
          issuedAt: true,
          totalAmount: true,
        },
      },
    },
  });

  if (!ret) notFound();

  // Calculate days since order for 14-day withdrawal check
  const daysSinceOrder = Math.floor(
    (ret.createdAt.getTime() - ret.order.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  const isWithin14Days = daysSinceOrder <= 14;

  return (
    <>
      <Link
        href="/admin/returns"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zpět na vratky
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {ret.returnNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vytvořena {formatDate(ret.createdAt)}
            {ret.resolvedAt && <> · Vyřízena {formatDate(ret.resolvedAt)}</>}
            {ret.completedAt && <> · Dokončena {formatDate(ret.completedAt)}</>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${RETURN_STATUS_COLORS[ret.status] ?? "bg-muted text-muted-foreground"}`}
          >
            {RETURN_STATUS_LABELS[ret.status] ?? ret.status}
          </span>
          <ReturnStatusSelect returnId={ret.id} currentStatus={ret.status} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Return items */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card shadow-sm">
            <div className="border-b px-5 py-4">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Vracené položky ({ret.items.length})
              </h2>
            </div>
            <div className="divide-y">
              {ret.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {item.productName}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {item.size && <span>Vel. {item.size}</span>}
                      {item.color && <span>Barva: {item.color}</span>}
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
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t px-5 py-4">
              <div className="flex justify-between text-base font-semibold">
                <span>Částka k vrácení</span>
                <span>{formatPrice(ret.refundAmount)}</span>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold text-foreground">
              Důvod vratky
            </h2>
            <div className="mt-3 space-y-2">
              <p className="text-sm">
                <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {RETURN_REASON_LABELS[ret.reason] ?? ret.reason}
                </span>
              </p>
              {ret.reason === "withdrawal_14d" && (
                <p
                  className={`text-xs ${isWithin14Days ? "text-emerald-600" : "text-red-600"}`}
                >
                  {isWithin14Days
                    ? `✓ Vráceno ${daysSinceOrder} dní po objednání (v zákonné lhůtě 14 dnů)`
                    : `✗ Vráceno ${daysSinceOrder} dní po objednání (mimo zákonnou lhůtu 14 dnů)`}
                </p>
              )}
              {ret.reasonDetail && (
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {ret.reasonDetail}
                </p>
              )}
            </div>
          </div>

          {/* Admin note */}
          {ret.adminNote && (
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <h2 className="font-heading text-base font-semibold text-foreground">
                Interní poznámka
              </h2>
              <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
                {ret.adminNote}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order info */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold text-foreground">
              Objednávka
            </h2>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Číslo</span>
                <Link
                  href={`/admin/orders/${ret.order.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {ret.order.orderNumber}
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="text-foreground">
                  {ORDER_STATUS_LABELS[ret.order.status] ?? ret.order.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Celkem</span>
                <span className="font-medium">{formatPrice(ret.order.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Datum</span>
                <span>{formatDate(ret.order.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Credit note */}
          <CreditNoteSection
            returnId={ret.id}
            returnStatus={ret.status}
            existingCreditNote={ret.creditNotes[0] ?? null}
            hasInvoice={ret.order.invoices.length > 0}
          />

          {/* Customer info */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold text-foreground">
              Zákazník
            </h2>
            <div className="mt-3 space-y-1 text-sm">
              <p className="font-medium text-foreground">
                {ret.customer.firstName} {ret.customer.lastName}
              </p>
              <p className="text-muted-foreground">{ret.customer.email}</p>
              {ret.customer.phone && (
                <p className="text-muted-foreground">{ret.customer.phone}</p>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-heading text-base font-semibold text-foreground">
              Časová osa
            </h2>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <div className="mt-1.5 size-2 rounded-full bg-muted-foreground" />
                <div>
                  <p className="text-foreground">Objednávka vytvořena</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(ret.order.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1.5 size-2 rounded-full bg-amber-500" />
                <div>
                  <p className="text-foreground">Vratka podána</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(ret.createdAt)}
                  </p>
                </div>
              </div>
              {ret.resolvedAt && (
                <div className="flex items-start gap-2">
                  <div
                    className={`mt-1.5 size-2 rounded-full ${ret.status === "rejected" ? "bg-red-500" : "bg-sky-500"}`}
                  />
                  <div>
                    <p className="text-foreground">
                      {ret.status === "rejected" ? "Zamítnuta" : "Schválena"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(ret.resolvedAt)}
                    </p>
                  </div>
                </div>
              )}
              {ret.completedAt && (
                <div className="flex items-start gap-2">
                  <div className="mt-1.5 size-2 rounded-full bg-emerald-500" />
                  <div>
                    <p className="text-foreground">Vrácení dokončeno</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(ret.completedAt)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
