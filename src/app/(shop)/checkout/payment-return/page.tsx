import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
import { getComgatePaymentStatus } from "@/lib/payments/comgate";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import { Button } from "@/components/ui/button";
import { XCircle, Clock, ArrowRight } from "lucide-react";
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

  const db = await getDb();

  // Find the order by reference ID (order number)
  const order = await db.order.findUnique({
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
  // Use strict check: if accessToken is somehow null, still deny access (same as order page).
  if (!token || order.accessToken !== token) notFound();

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

      // If Comgate says PAID but webhook hasn't processed yet, update now.
      // Use updateMany with status guard for atomic TOCTOU-safe write.
      if (status.status === "PAID" && order.status === "pending") {
        const updated = await db.order.updateMany({
          where: { id: order.id, status: "pending" },
          data: { status: "paid" },
        });

        // Send payment confirmed email if we were the ones to transition to PAID
        // (the webhook would skip since status is no longer "pending").
        if (updated.count > 0) {
          const fullOrder = await db.order.findUnique({
            where: { id: order.id },
            include: { customer: true },
          });
          if (fullOrder) {
            sendPaymentConfirmedEmail({
              orderNumber: fullOrder.orderNumber,
              customerName: `${fullOrder.customer.firstName} ${fullOrder.customer.lastName}`,
              customerEmail: fullOrder.customer.email,
              total: fullOrder.total,
              accessToken: fullOrder.accessToken ?? "",
            }).catch((err) => {
              console.error(`[Payment] Failed to send confirmation email for ${fullOrder.orderNumber}:`, err);
            });
          }
        }

        redirect(`/order/${order.orderNumber}?token=${order.accessToken}`);
      }

      // If Comgate says CANCELLED but webhook hasn't processed yet, cancel now.
      // Without this, products stay marked as sold when user cancels at Comgate,
      // blocking retry (checkout would fail on "product unavailable").
      // Uses same atomic pattern as webhook: updateMany with status guard + transaction.
      if (status.status === "CANCELLED" && order.status === "pending") {
        await db.$transaction(async (tx) => {
          const updated = await tx.order.updateMany({
            where: { id: order.id, status: "pending" },
            data: { status: "cancelled" },
          });
          if (updated.count === 0) return; // Webhook already handled it
          const items = await tx.orderItem.findMany({
            where: { orderId: order.id },
            select: { productId: true },
          });
          await tx.product.updateMany({
            where: { id: { in: items.map((i) => i.productId) }, active: true, sold: true },
            data: { sold: false, stock: 1 },
          });
        });
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
