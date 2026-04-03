import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { ClearCartOnMount } from "./clear-cart";

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Objednávka ${orderNumber}` };
}

export default async function OrderConfirmationPage({ params }: Props) {
  const { orderNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      customer: true,
      items: true,
    },
  });

  if (!order) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <ClearCartOnMount />

      <CheckCircle2 className="mx-auto size-16 text-emerald-500" />

      <h1 className="mt-6 font-heading text-3xl font-bold text-foreground">
        Děkujeme za objednávku!
      </h1>
      <p className="mt-2 text-muted-foreground">
        Vaše objednávka <strong>{order.orderNumber}</strong> byla úspěšně
        přijata.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Potvrzení jsme odeslali na{" "}
        <strong>{order.customer.email}</strong>.
      </p>

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
          <div className="mt-3 flex justify-between border-t pt-3 text-lg font-bold">
            <span>Celkem</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Shipping address */}
        <div className="mt-6 border-t pt-4">
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
            <p className="mt-1 text-sm text-muted-foreground">{order.note}</p>
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
