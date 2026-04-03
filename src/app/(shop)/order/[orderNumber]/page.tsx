import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { ClearCartOnMount } from "./clear-cart";

interface Props {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Objednávka ${orderNumber}` };
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  comgate: "Online platba",
  cod: "Dobírka",
};

export default async function OrderConfirmationPage({ params, searchParams }: Props) {
  const { orderNumber } = await params;
  const { token } = await searchParams;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      customer: true,
      items: true,
    },
  });

  if (!order) notFound();

  // Orders with an accessToken require the correct token in the URL.
  // This prevents enumeration of order details (PII exposure).
  if (order.accessToken && order.accessToken !== token) notFound();

  const isPaid = order.status === "paid";
  const isCod = order.paymentMethod === "cod";
  const isPending = order.status === "pending" && !isCod;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <ClearCartOnMount />

      {isPending ? (
        <Clock className="mx-auto size-16 text-amber-500" />
      ) : (
        <CheckCircle2 className="mx-auto size-16 text-emerald-500" />
      )}

      <h1 className="mt-6 font-heading text-3xl font-bold text-foreground">
        {isPending ? "Objednávka přijata" : "Děkujeme za objednávku!"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Vaše objednávka <strong>{order.orderNumber}</strong> byla úspěšně
        přijata.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Potvrzení jsme odeslali na{" "}
        <strong>{order.customer.email}</strong>.
      </p>

      {/* Payment status banner */}
      {isPaid && (
        <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Platba byla úspěšně přijata
        </div>
      )}
      {isCod && (
        <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Platba na dobírku — zaplatíte {formatPrice(order.total)} při převzetí
        </div>
      )}
      {isPending && (
        <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Čekáme na potvrzení platby. Jakmile bude platba přijata, pošleme vám
          email.
        </div>
      )}

      {/* Order details */}
      <div className="mt-8 rounded-xl border bg-card p-6 text-left shadow-sm">
        <h2 className="font-heading text-lg font-semibold">
          Detail objednávky
        </h2>

        <div className="mt-4 divide-y">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between gap-2 py-3"
            >
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.size}
                  {item.color && ` · ${item.color}`}
                </p>
              </div>
              <span className="text-sm font-medium">
                {formatPrice(item.price)}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Mezisoučet</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-muted-foreground">Doprava</span>
            <span>{order.shipping === 0 ? "Zdarma" : formatPrice(order.shipping)}</span>
          </div>
          {isCod && order.total > order.subtotal + order.shipping && (
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-muted-foreground">Dobírka</span>
              <span>{formatPrice(order.total - order.subtotal - order.shipping)}</span>
            </div>
          )}
          <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold">
            <span>Celkem</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="mt-4 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">
            Způsob platby
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {PAYMENT_METHOD_LABELS[order.paymentMethod ?? ""] ??
              order.paymentMethod ??
              "Neznámý"}
          </p>
        </div>

        {/* Shipping address */}
        <div className="mt-4 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">
            Doručovací adresa
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.shippingName}
            <br />
            {order.shippingStreet}
            <br />
            {order.shippingZip} {order.shippingCity}
          </p>
        </div>

        {order.note && (
          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-foreground">
              Poznámka
            </h3>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{order.note}</p>
          </div>
        )}
      </div>

      <div className="mt-8">
        <Button render={<Link href="/products" />}>
          Pokračovat v nákupu
          <ArrowRight data-icon="inline-end" className="size-4" />
        </Button>
      </div>
    </div>
  );
}
