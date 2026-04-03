"use server";

import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { z } from "zod";

const checkoutSchema = z.object({
  email: z.string().email("Zadejte platný email"),
  firstName: z.string().min(1, "Jméno je povinné"),
  lastName: z.string().min(1, "Příjmení je povinné"),
  phone: z.string().min(9, "Zadejte platné telefonní číslo"),
  street: z.string().min(1, "Ulice je povinná"),
  city: z.string().min(1, "Město je povinné"),
  zip: z.string().min(5, "Zadejte platné PSČ"),
  note: z.string().optional(),
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

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
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

  // Verify all products are still available
  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true, sold: false },
  });

  const availableIds = new Set(products.map((p) => p.id));
  const unavailable = data.items.filter((i) => !availableIds.has(i.productId));
  if (unavailable.length > 0) {
    const names = unavailable.map((i) => i.name).join(", ");
    return {
      error: `Tyto produkty už bohužel nejsou dostupné: ${names}. Odeberte je z košíku a zkuste to znovu.`,
      fieldErrors: {},
    };
  }

  // Calculate totals
  const subtotal = data.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shipping = 0; // Free shipping for now, Packeta will come later
  const total = subtotal + shipping;

  // Create or find customer
  let customer = await prisma.customer.findUnique({
    where: { email: data.email },
  });

  if (customer) {
    customer = await prisma.customer.update({
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
    customer = await prisma.customer.create({
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

  // Create order
  const orderNumber = generateOrderNumber();
  const order = await prisma.order.create({
    data: {
      orderNumber,
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
        create: data.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
        })),
      },
    },
  });

  // Mark products as sold (second-hand: each piece is unique)
  await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: { sold: true, stock: 0 },
  });

  redirect(`/order/${order.orderNumber}`);
}
