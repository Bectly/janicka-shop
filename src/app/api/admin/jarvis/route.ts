import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";
import { logger } from "@/lib/logger";

const commandSchema = z.object({
  command: z.string().min(1).max(500),
  confirm: z.boolean().optional(),
  safeMode: z.boolean().optional(),
});

type JarvisReply = {
  lines: string[];
  kind?: "info" | "ok" | "warn" | "err";
  requiresConfirm?: boolean;
  blocked?: boolean;
};

const DANGEROUS_VERBS = new Set([
  "cancel",
  "refund",
  "hide",
  "delete",
  "reset",
  "drop",
]);

const HELP: string[] = [
  "Dostupné příkazy:",
  "  help                  — tento výpis",
  "  about                 — kdo je JARVIS",
  "  status                — aktuální stav obchodu",
  "  stats                 — čísla z posledních 24h",
  "  orders                — posledních 5 objednávek",
  "  products              — počet produktů podle stavu",
  "  whoami                — tvoje session",
  "  clear                 — vyčistit terminál",
  "  exit                  — zpátky na dashboard",
  "",
  "Nebezpečné příkazy (mění data — vyžadují potvrzení):",
  "  cancel <číslo>        — zruší objednávku",
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

    case "cancel": {
      const [, orderNumber] = trimmed.split(/\s+/);
      if (!orderNumber) {
        return {
          kind: "err",
          lines: ["Použij: cancel <číslo objednávky>"],
        };
      }
      const db = await getDb();
      const order = await db.order.findUnique({
        where: { orderNumber },
        select: { id: true, orderNumber: true, status: true },
      });
      if (!order) {
        return {
          kind: "err",
          lines: [`Objednávka #${orderNumber} neexistuje.`],
        };
      }
      if (order.status === "cancelled") {
        return {
          kind: "warn",
          lines: [`Objednávka #${orderNumber} už je zrušená.`],
        };
      }
      await db.order.update({
        where: { id: order.id },
        data: { status: "cancelled" },
      });
      return {
        kind: "ok",
        lines: [`Objednávka #${order.orderNumber} zrušena.`],
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
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ip = await getClientIp();
  const rl = checkRateLimit(
    `jarvis:${session.user.id ?? ip}`,
    20,
    60 * 1000,
  );
  if (!rl.success) {
    return NextResponse.json(
      { error: "Příliš mnoho příkazů — zkus to za chvíli." },
      { status: 429 },
    );
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

  const [verb] = parsed.data.command.trim().toLowerCase().split(/\s+/);
  const isDangerous = DANGEROUS_VERBS.has(verb);

  if (isDangerous && parsed.data.safeMode) {
    const reply: JarvisReply = {
      kind: "warn",
      blocked: true,
      lines: [
        "🛡 Safe mode je zapnutý — nebezpečné příkazy jsou blokovány.",
        "Přepni safe mode tlačítkem nad terminálem a zkus znovu.",
      ],
    };
    try {
      const db = await getDb();
      await db.jarvisConsoleLog.create({
        data: {
          userId: session.user.id ?? null,
          userEmail: session.user.email ?? "admin@janicka",
          command: `[blocked-safe-mode] ${parsed.data.command}`,
          kind: "warn",
        },
      });
    } catch (err) {
      logger.error("[jarvis] failed to write audit log", err);
    }
    return NextResponse.json(reply);
  }

  if (isDangerous && !parsed.data.confirm) {
    return NextResponse.json({
      kind: "warn",
      requiresConfirm: true,
      lines: [
        `⚠ Nebezpečný příkaz: ${verb}`,
        "Tato akce změní data v DB. Vyžaduje se potvrzení.",
      ],
    } satisfies JarvisReply);
  }

  const reply = await handleCommand(
    parsed.data.command,
    session.user.name ?? "Admin",
    session.user.email ?? "admin@janicka",
  );

  try {
    const db = await getDb();
    await db.jarvisConsoleLog.create({
      data: {
        userId: session.user.id ?? null,
        userEmail: session.user.email ?? "admin@janicka",
        command: isDangerous
          ? `[confirmed] ${parsed.data.command}`
          : parsed.data.command,
        kind: reply.kind ?? null,
      },
    });
  } catch (err) {
    logger.error("[jarvis] failed to write audit log", err);
  }

  return NextResponse.json(reply);
}
