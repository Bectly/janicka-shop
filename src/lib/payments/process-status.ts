import { getDb } from "@/lib/db";
import { sendPaymentConfirmedEmail, sendAdminNewOrderEmail } from "@/lib/email";
import { dispatchEmail } from "@/lib/email-dispatch";
import { logOrderToHeureka } from "@/lib/heureka";
import type { ComgatePaymentStatus } from "./types";

/**
 * Map provider payment status to order status update.
 * Only advances order status — never reverts a more advanced status.
 *
 * Shared by the Comgate webhook (/api/payments/comgate) and the mock confirm
 * endpoint (/api/payments/mock/confirm) so both providers trigger identical
 * email + Heureka + admin-notification side effects.
 */
export async function processPaymentStatus(
  orderId: string,
  currentOrderStatus: string,
  status: ComgatePaymentStatus,
  providerLabel: string = "comgate",
): Promise<void> {
  const db = await getDb();
  switch (status) {
    case "PAID": {
      if (currentOrderStatus === "pending") {
        const updated = await db.order.updateMany({
          where: { id: orderId, status: "pending" },
          data: { status: "paid" },
        });

        if (updated.count > 0) {
          const order = await db.order.findUnique({
            where: { id: orderId },
            include: {
              customer: true,
              items: { include: { product: { select: { sku: true } } } },
            },
          });
          if (order) {
            dispatchEmail(
              "payment-confirmed",
              {
                orderNumber: order.orderNumber,
                customerName: `${order.customer.firstName} ${order.customer.lastName}`,
                customerEmail: order.customer.email,
                total: order.total,
                accessToken: order.accessToken ?? "",
              },
              sendPaymentConfirmedEmail,
            ).catch((err) => {
              console.error(
                `[${providerLabel}] Payment confirmation dispatch failed for ${order.orderNumber}:`,
                err,
              );
            });

            dispatchEmail(
              "admin-new-order",
              {
                orderNumber: order.orderNumber,
                orderId: order.id,
                customerName: `${order.customer.firstName} ${order.customer.lastName}`,
                customerEmail: order.customer.email,
                items: order.items.map((i) => ({
                  name: i.name,
                  price: i.price,
                  size: i.size,
                  color: i.color,
                })),
                total: order.total,
                paymentMethod: order.paymentMethod ?? providerLabel,
                shippingMethod: order.shippingMethod ?? "",
                paid: true,
              },
              sendAdminNewOrderEmail,
            ).catch((err) => {
              console.error(
                `[${providerLabel}] Admin notification dispatch failed for ${order.orderNumber}:`,
                err,
              );
            });

            logOrderToHeureka(
              order.customer.email,
              order.orderNumber,
              order.items.map((i) => i.product.sku),
            ).catch((err) => {
              console.error(
                `[${providerLabel}] Heureka ORDER_INFO failed for ${order.orderNumber}:`,
                err,
              );
            });
          }
        }
      }
      break;
    }
    case "CANCELLED": {
      if (currentOrderStatus === "pending") {
        await db.$transaction(async (tx) => {
          const updated = await tx.order.updateMany({
            where: { id: orderId, status: "pending" },
            data: { status: "cancelled" },
          });
          if (updated.count === 0) return;

          const items = await tx.orderItem.findMany({
            where: { orderId },
            select: { productId: true },
          });
          const productIds = items.map((i) => i.productId);
          await tx.product.updateMany({
            where: { id: { in: productIds }, active: true, sold: true },
            data: { sold: false, stock: 1 },
          });
        });
      }
      break;
    }
    case "AUTHORIZED":
    case "PENDING":
      break;
    default: {
      console.warn(
        `[${providerLabel}] Unknown payment status "${status}" for order ${orderId}`,
      );
      break;
    }
  }
}
