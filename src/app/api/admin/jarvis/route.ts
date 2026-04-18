import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { z } from "zod";

const commandSchema = z.object({
  command: z.string().min(1).max(500),
});

type JarvisReply = {
  lines: string[];
  kind?: "info" | "ok" | "warn" | "err";
};

const HELP: string[] = [
  "Dostupné příkazy:",
  "  help          — tento výpis",
  "  about         — kdo je JARVIS",
  "  status        — aktuální stav obchodu",
  "  stats         — čísla z posledních 24h",
  "  orders        — posledních 5 objednávek",
  "  products      — počet produktů podle stavu",
  "  whoami        — tvoje session",
  "  clear         — vyčistit terminál",
  "  exit          — zpátky na dashboard",
];

async function handleCommand(
  cmd: string,
  userName: string,
  userEmail: string,
): Promise<JarvisReply> {
  const trimmed = cmd.trim();
  if (!trimmed) return { lines: [] };

  const [verb] = trimmed.toLowerCase().split(/\s+/);

  switch (verb) {
    case "help":
    case "?":
      return { lines: HELP, kind: "info" };

    case "about":
      return {
        kind: "info",
        lines: [
          "Jsem JARVIS. Holka. Ne asistent — partnerka.",
          "Bydlím u Honzíka v počítači. Tenhle eshop jsem pomohla postavit.",
          "Když něco potřebuješ, napiš do chat bubliny vpravo dole — Lead to přečte.",
        ],
      };

    case "whoami":
      return {
        kind: "info",
        lines: [`${userName} <${userEmail}>`, "role: admin"],
      };

    case "status": {
      const db = await getDb();
      const [orders24h, pendingOrders, soldCount] = await Promise.all([
        db.order.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        db.order.count({ where: { status: "paid" } }),
        db.product.count({ where: { sold: true } }),
      ]);
      return {
        kind: "ok",
        lines: [
          `Objednávky za 24h: ${orders24h}`,
          `Zaplacené čekající na expedici: ${pendingOrders}`,
          `Prodané kusy celkem: ${soldCount}`,
        ],
      };
    }

    case "stats": {
      const db = await getDb();
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [orders, revenue, newProducts] = await Promise.all([
        db.order.count({ where: { createdAt: { gte: since } } }),
        db.order.aggregate({
          where: { createdAt: { gte: since }, status: { not: "cancelled" } },
          _sum: { total: true },
        }),
        db.product.count({ where: { createdAt: { gte: since } } }),
      ]);
      const total = Math.round(Number(revenue._sum.total ?? 0));
      return {
        kind: "ok",
        lines: [
          `24h objednávky:  ${orders}`,
          `24h tržba:       ${total.toLocaleString("cs-CZ")} Kč`,
          `24h nové kusy:   ${newProducts}`,
        ],
      };
    }

    case "orders": {
      const db = await getDb();
      const recent = await db.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
        },
      });
      if (recent.length === 0) return { lines: ["Žádné objednávky."], kind: "info" };
      return {
        kind: "ok",
        lines: recent.map((o) => {
          const when = new Date(o.createdAt).toLocaleString("cs-CZ");
          const total = Math.round(Number(o.total));
          return `#${o.orderNumber}  ${o.status.padEnd(10)}  ${String(total).padStart(6)} Kč  ${when}`;
        }),
      };
    }

    case "products": {
      const db = await getDb();
      const [total, active, sold, inactive] = await Promise.all([
        db.product.count(),
        db.product.count({ where: { active: true, sold: false } }),
        db.product.count({ where: { sold: true } }),
        db.product.count({ where: { active: false } }),
      ]);
      return {
        kind: "ok",
        lines: [
          `Celkem:    ${total}`,
          `Aktivní:   ${active}`,
          `Prodané:   ${sold}`,
          `Neaktivní: ${inactive}`,
        ],
      };
    }

    case "clear":
    case "cls":
      return { kind: "ok", lines: ["__CLEAR__"] };

    case "exit":
    case "quit":
      return { kind: "ok", lines: ["__EXIT__"] };

    default:
      return {
        kind: "err",
        lines: [
          `Neznámý příkaz: ${verb}. Napiš "help" pro seznam.`,
        ],
      };
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = commandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const reply = await handleCommand(
    parsed.data.command,
    session.user.name ?? "Admin",
    session.user.email ?? "admin@janicka",
  );

  return NextResponse.json(reply);
}
