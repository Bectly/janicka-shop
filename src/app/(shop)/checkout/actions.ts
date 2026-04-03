"use server";

import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getVisitorId } from "@/lib/visitor";

const checkoutSchema = z.object({
  email: z.string().email("Zadejte platný email").max(254),
  firstName: z.string().min(1, "Jméno je povinné").max(100, "Jméno je příliš dlouhé"),
  lastName: z.string().min(1, "Příjmení je povinné").max(100, "Příjmení je příliš dlouhé"),
  phone: z.string().min(9, "Zadejte platné telefonní číslo").max(30, "Neplatné telefonní číslo"),
  street: z.string().min(1, "Ulice je povinná").max(200, "Adresa je příliš dlouhá"),
  city: z.string().min(1, "Město je povinné").max(100, "Název města je příliš dlouhý"),
  zip: z.string().min(5, "Zadejte platné PSČ").max(10, "Neplatné PSČ"),
  note: z.string().max(2000, "Poznámka může mít maximálně 2000 znaků").optional(),
  items: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      price: z.number(),
      size: z.string(),
      color: z.string(),
      quantity: z.number(),
    })
  ).min(1, "Košík je prázdný"),
});

class UnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnavailableError";
  }
}

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  // 8 random chars for ~2.8 trillion combinations — prevents order URL enumeration
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(5)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 8)
    .toUpperCase();
  return `JN-${y}${m}${d}-${rand}`;
}

export type CheckoutState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

export async function createOrder(
  _prev: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const itemsJson = formData.get("items") as string;
  let items: z.infer<typeof checkoutSchema>["items"];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { error: "Neplatná data košíku", fieldErrors: {} };
  }

  const raw = {
    email: formData.get("email") as string,
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    phone: formData.get("phone") as string,
    street: formData.get("street") as string,
    city: formData.get("city") as string,
    zip: formData.get("zip") as string,
    note: (formData.get("note") as string) || undefined,
    items,
  };

  const result = checkoutSchema.safeParse(raw);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: null, fieldErrors };
  }

  const data = result.data;
  const productIds = data.items.map((i) => i.productId);
  const visitorId = await getVisitorId();

  // Use a transaction to prevent double-sell race conditions.
  // Inside the transaction: verify availability, use DB prices (never trust client), create order, mark sold.
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      // Verify all products are still available (authoritative check inside transaction)
      // Products reserved by this visitor are considered available
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, active: true, sold: false },
      });

      const now = new Date();
      const productMap = new Map(products.map((p) => [p.id, p]));
      const unavailable = data.items.filter((i) => {
        const p = productMap.get(i.productId);
        if (!p) return true; // not found
        // Check if reserved by someone else (and reservation hasn't expired)
        if (p.reservedUntil && p.reservedUntil > now && p.reservedBy !== visitorId) {
          return true;
        }
        return false;
      });
      if (unavailable.length > 0) {
        const names = unavailable.map((i) => i.name).join(", ");
        throw new UnavailableError(
          `Tyto produkty už bohužel nejsou dostupné: ${names}. Odeberte je z košíku a zkuste to znovu.`
        );
      }

      // Use server-side prices from DB — never trust client-provided prices
      const subtotal = data.items.reduce((sum, i) => {
        const dbProduct = productMap.get(i.productId)!;
        return sum + dbProduct.price * 1; // qty is always 1 for second-hand
      }, 0);
      const shipping = 0; // Free shipping for now, Packeta will come later
      const total = subtotal + shipping;

      // Create or find customer
      let customer = await tx.customer.findUnique({
        where: { email: data.email },
      });

      if (customer) {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            street: data.street,
            city: data.city,
            zip: data.zip,
          },
        });
      } else {
        customer = await tx.customer.create({
          data: {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            street: data.street,
            city: data.city,
            zip: data.zip,
          },
        });
      }

      // Create order with DB-sourced prices
      const orderNumber = generateOrderNumber();
      const accessToken = crypto.randomUUID();
      const created = await tx.order.create({
        data: {
          orderNumber,
          accessToken,
          customerId: customer.id,
          status: "pending",
          subtotal,
          shipping,
          total,
          note: data.note ?? null,
          shippingName: `${data.firstName} ${data.lastName}`,
          shippingStreet: data.street,
          shippingCity: data.city,
          shippingZip: data.zip,
          items: {
            create: data.items.map((item) => {
              const dbProduct = productMap.get(item.productId)!;
              return {
                productId: item.productId,
                name: dbProduct.name,
                price: dbProduct.price,
                quantity: 1,
                size: item.size,
                color: item.color,
              };
            }),
          },
        },
      });

      // Mark products as sold and clear reservations (second-hand: each piece is unique)
      await tx.product.updateMany({
        where: { id: { in: productIds } },
        data: { sold: true, stock: 0, reservedUntil: null, reservedBy: null },
      });

      return created;
    });
  } catch (e) {
    if (e instanceof UnavailableError) {
      return { error: e.message, fieldErrors: {} };
    }
    throw e;
  }

  redirect(`/order/${order.orderNumber}?token=${order.accessToken}`);
}
