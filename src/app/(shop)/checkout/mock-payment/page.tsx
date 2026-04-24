import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { getPaymentProviderName } from "@/lib/payments/provider";
import { MockPaymentForm } from "./mock-payment-form";

/**
 * Mock payment gate — shown when PAYMENT_PROVIDER=mock.
 *
 * Verifies the order + access token server-side, then renders the client form
 * where the user picks a test card and confirms or declines.
 */

export default async function MockPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; trans?: string; token?: string }>;
}) {
  await connection();
  if (getPaymentProviderName() !== "mock") notFound();

  const sp = await searchParams;
  const orderNumber = sp.ref;
  const transId = sp.trans;
  const token = sp.token;

  if (!orderNumber || !transId || !token) notFound();

  const db = await getDb();
  const order = await db.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      accessToken: true,
      total: true,
      status: true,
      paymentId: true,
    },
  });

  if (!order || order.accessToken !== token) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <div className="mb-6 rounded-lg border border-champagne bg-champagne-light px-3 py-2 text-xs text-champagne-dark">
        <strong>🧪 Testovací režim</strong> — toto je mock platební brána. Žádné
        peníze nebudou strženy.
      </div>

      <h1 className="font-heading text-2xl font-bold">Mock platba</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Objednávka <strong>{order.orderNumber}</strong> · částka{" "}
        <strong>{order.total.toLocaleString("cs-CZ")} Kč</strong>
      </p>

      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <MockPaymentForm
          orderNumber={order.orderNumber}
          transId={transId}
          token={token}
        />
      </div>
    </div>
  );
}
