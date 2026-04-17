import { NextResponse } from "next/server";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  await connection();
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ orders: [], products: [], customers: [] });
  }

  const db = await getDb();
  const take = 6;

  const [orders, products, customers] = await Promise.all([
    db.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: q } },
          { customer: { email: { contains: q } } },
          { customer: { firstName: { contains: q } } },
          { customer: { lastName: { contains: q } } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        customer: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.product.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { sku: { contains: q } },
          { brand: { contains: q } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        active: true,
        sold: true,
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
    db.customer.findMany({
      where: {
        OR: [
          { email: { contains: q } },
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { phone: { contains: q } },
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      total: o.total,
      customer: `${o.customer.firstName} ${o.customer.lastName}`.trim(),
      email: o.customer.email,
    })),
    products,
    customers: customers.map((c) => ({
      id: c.id,
      email: c.email,
      name: `${c.firstName} ${c.lastName}`.trim(),
      orderCount: c._count.orders,
    })),
  });
}
