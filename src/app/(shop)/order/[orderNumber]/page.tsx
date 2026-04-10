import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/lib/db";

import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, ArrowRight, MapPin, Truck, CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { ClearCartOnMount } from "./clear-cart";
import { TrackPurchase } from "@/components/shop/track-purchase";
import { generateOrderQrPayment, orderNumberToVariableSymbol } from "@/lib/payments/qr-platba";
import { QrPaymentCode } from "@/components/shop/qr-payment-code";
import { PaymentStatusPoller } from "@/components/shop/payment-status-poller";
import { CreateAccountCard } from "@/components/shop/create-account-card";
import { ReferralCard } from "@/components/shop/referral-card";

interface Props {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `Objednávka ${orderNumber}` };
}

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

export default async function OrderConfirmationPage({ params, searchParams }: Props) {
  await connection();
  const { orderNumber } = await params;
  const { token } = await searchParams;

  const db = await getDb();
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: {
      customer: true,
      items: true,
    },
  });

  if (!order) notFound();

  // Every order should have an accessToken (set during checkout).
  // Require a matching token to prevent order detail enumeration (PII exposure).
  // If accessToken is somehow null, still require a token to deny access.
  if (!token || order.accessToken !== token) notFound();

  const isPaid = order.status === "paid";
  const isCod = order.paymentMethod === "cod";
  const isPending = order.status === "pending" && !isCod;
  const showAccountCreation = !order.customer.password;

  // Look up referral code generated for this order
  const referralEntry = await db.referralCode.findFirst({
    where: { orderNumber: order.orderNumber },
    select: { code: true },
  });

  // Generate QR payment code for bank transfer orders that are still pending
  const isBankTransfer = order.paymentMethod === "bank_transfer";
  const showQr = isPending && isBankTransfer;
  let qrPayment: Awaited<ReturnType<typeof generateOrderQrPayment>> | null = null;
  if (showQr) {
    try {
      qrPayment = await generateOrderQrPayment(order.orderNumber, order.total);
    } catch (e) {
      console.warn(`[Order] QR payment generation failed for ${order.orderNumber}:`, e);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <ClearCartOnMount orderedProductIds={order.items.map((i) => i.productId)} />
      <TrackPurchase
        transactionId={order.orderNumber}
        items={order.items.map((i) => ({
          id: i.productId,
          name: i.name,
          price: i.price,
        }))}
        total={order.total}
      />

      {isPending ? (
        <Clock className="mx-auto size-16 text-champagne-dark" />
      ) : (
        <CheckCircle2 className="mx-auto size-16 text-sage" />
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
        <div className="mt-4 rounded-lg bg-sage-light px-4 py-3 text-sm text-sage-dark">
          Platba byla úspěšně přijata
        </div>
      )}
      {isCod && (
        <div className="mt-4 rounded-lg bg-champagne-light px-4 py-3 text-sm text-charcoal">
          Platba na dobírku — zaplatíte {formatPrice(order.total)} při převzetí
        </div>
      )}
      {isPending && (
        <>
          <div className="mt-4 rounded-lg bg-champagne-light px-4 py-3 text-sm text-charcoal">
            Čekáme na potvrzení platby. Jakmile bude platba přijata, pošleme vám
            email.
          </div>
          <PaymentStatusPoller
            orderNumber={order.orderNumber}
            accessToken={token!}
          />
        </>
      )}

      {/* QR payment code for bank transfer */}
      {qrPayment && (
        <div className="mt-6 text-left">
          <QrPaymentCode
            qrDataUrl={qrPayment.qrDataUrl}
            spaydString={qrPayment.spaydString}
            totalCzk={order.total}
            variableSymbol={orderNumberToVariableSymbol(order.orderNumber)}
            iban={process.env.SHOP_IBAN ?? ""}
          />
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
          {order.referralDiscount > 0 && (
            <div className="mt-1 flex justify-between text-sm text-sage-dark">
              <span>Sleva z doporučení</span>
              <span>-{formatPrice(order.referralDiscount)}</span>
            </div>
          )}
          {order.storeCreditUsed > 0 && (
            <div className="mt-1 flex justify-between text-sm text-sage-dark">
              <span>Kredit z doporučení</span>
              <span>-{formatPrice(order.storeCreditUsed)}</span>
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

        {/* Shipping method + address */}
        <div className="mt-4 border-t pt-4">
          <h3 className="text-sm font-semibold text-foreground">
            Doprava
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {SHIPPING_METHOD_LABELS[order.shippingMethod ?? ""] ??
              order.shippingMethod ??
              "Standardní doručení"}
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
            <p className="mt-1 text-sm text-muted-foreground">
              {order.shippingName}
              <br />
              {order.shippingStreet}
              <br />
              {order.shippingZip} {order.shippingCity}
            </p>
          )}
        </div>

        {order.trackingNumber && (
          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-foreground">
              Sledování zásilky
            </h3>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary/5 p-3">
              <Truck className="size-4 shrink-0 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {order.trackingNumber}
              </span>
            </div>
          </div>
        )}

        {order.expectedDeliveryDate && (
          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-foreground">
              Předpokládané doručení
            </h3>
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-blue-50 p-3">
              <CalendarClock className="size-4 shrink-0 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                do {new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", year: "numeric" }).format(new Date(order.expectedDeliveryDate))}
              </span>
            </div>
          </div>
        )}

        {order.note && (
          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-semibold text-foreground">
              Poznámka
            </h3>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{order.note}</p>
          </div>
        )}
      </div>

      {/* Post-purchase account creation — only for guests without password */}
      {showAccountCreation && token && (
        <CreateAccountCard orderNumber={order.orderNumber} accessToken={token} />
      )}

      {/* Referral prompt — bilateral: 150 CZK credit for referrer, 100 CZK off for friend */}
      <ReferralCard orderNumber={order.orderNumber} referralCode={referralEntry?.code} />

      <div className="mt-8">
        <Button render={<Link href="/products" />}>
          Pokračovat v nákupu
          <ArrowRight data-icon="inline-end" className="size-4" />
        </Button>
      </div>
    </div>
  );
}
