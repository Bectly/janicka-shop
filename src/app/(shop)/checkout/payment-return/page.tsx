import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getComgatePaymentStatus } from "@/lib/payments/comgate";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stav platby",
};

interface Props {
  searchParams: Promise<{ refId?: string; token?: string }>;
}

export default async function PaymentReturnPage({ searchParams }: Props) {
  const { refId, token } = await searchParams;

  if (!refId) notFound();

  // Find the order by reference ID (order number)
  const order = await prisma.order.findUnique({
    where: { orderNumber: refId },
    select: {
      id: true,
      orderNumber: true,
      accessToken: true,
      status: true,
      paymentId: true,
    },
  });

  if (!order) notFound();

  // Validate access token to prevent order detail leakage.
  // The token is included in the Comgate return URL at payment creation time.
  if (order.accessToken && order.accessToken !== token) notFound();

  // If payment was already processed (by webhook), redirect to order page
  if (order.status === "paid" || order.status === "confirmed") {
    redirect(`/order/${order.orderNumber}?token=${order.accessToken}`);
  }

  // If we have a transId, check current payment status from Comgate
  let paymentStatus: string | null = null;
  if (order.paymentId) {
    try {
      const status = await getComgatePaymentStatus(order.paymentId);
      paymentStatus = status.status;

      // If Comgate says PAID but webhook hasn't processed yet, update now
      if (status.status === "PAID" && order.status === "pending") {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "paid", paymentMethod: "comgate" },
        });
        redirect(`/order/${order.orderNumber}?token=${order.accessToken}`);
      }
    } catch {
      // If status check fails, show pending state — webhook will handle it
      paymentStatus = "PENDING";
    }
  }

  // Cancelled payment
  if (paymentStatus === "CANCELLED" || order.status === "cancelled") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6 lg:px-8">
        <XCircle className="mx-auto size-16 text-red-500" />
        <h1 className="mt-6 font-heading text-2xl font-bold">
          Platba byla zrušena
        </h1>
        <p className="mt-2 text-muted-foreground">
          Vaše platba nebyla dokončena. Můžete to zkusit znovu nebo nás
          kontaktovat.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button render={<Link href="/cart" />}>Zpět do košíku</Button>
          <Button variant="outline" render={<Link href="/contact" />}>
            Kontaktovat nás
          </Button>
        </div>
      </div>
    );
  }

  // Payment still pending — show waiting state
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6 lg:px-8">
      <Clock className="mx-auto size-16 text-amber-500" />
      <h1 className="mt-6 font-heading text-2xl font-bold">
        Čekáme na potvrzení platby
      </h1>
      <p className="mt-2 text-muted-foreground">
        Vaše platba se zpracovává. Obvykle to trvá jen pár sekund.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Číslo objednávky: <strong>{order.orderNumber}</strong>
      </p>
      <p className="mt-4 text-xs text-muted-foreground">
        Potvrzení vám přijde na email. Pokud platba neproběhne do několika
        minut, kontaktujte nás.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          render={
            <Link
              href={`/order/${order.orderNumber}?token=${order.accessToken}`}
            />
          }
        >
          Zobrazit objednávku
          <ArrowRight data-icon="inline-end" className="size-4" />
        </Button>
        <Button variant="outline" render={<Link href="/products" />}>
          Pokračovat v nákupu
        </Button>
      </div>
    </div>
  );
}
