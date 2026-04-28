import { z } from "zod";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * J22/J23: Manager Threads — typed block schema + answer-watcher pipeline.
 *
 * Block types match docs/manager-tabs-spec.md (text/chart/image/actions/poll/
 * table/code). Persisted as JSON in ManagerThreadMessage.contentJson.
 */

export const TextBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("text"),
  bodyMd: z.string(),
});

export const ChartBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("chart"),
  chartType: z.enum(["bar", "line", "pie"]),
  title: z.string().optional(),
  data: z.array(z.object({ label: z.string(), value: z.number() })),
});

export const ImageBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("image"),
  url: z.string().url(),
  caption: z.string().optional(),
});

export const ActionsBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("actions"),
  buttons: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      action: z.string().min(1),
      payload: z.unknown().optional(),
    }),
  ),
});

export const PollBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("poll"),
  question: z.string().min(1),
  options: z.array(
    z.object({ id: z.string().min(1), label: z.string().min(1) }),
  ),
});

export const TableBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("table"),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const CodeBlockSchema = z.object({
  id: z.string().min(1),
  type: z.literal("code"),
  language: z.string(),
  source: z.string(),
});

export const ThreadBlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  ChartBlockSchema,
  ImageBlockSchema,
  ActionsBlockSchema,
  PollBlockSchema,
  TableBlockSchema,
  CodeBlockSchema,
]);

export type ThreadBlock = z.infer<typeof ThreadBlockSchema>;

export const ThreadBlocksSchema = z.array(ThreadBlockSchema);

export function parseBlocks(json: string): ThreadBlock[] {
  try {
    const parsed = JSON.parse(json);
    const result = ThreadBlocksSchema.safeParse(parsed);
    if (!result.success) return [];
    return result.data;
  } catch {
    return [];
  }
}

export function parseImageKeys(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function makeId(prefix = "blk"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function textBlock(bodyMd: string): ThreadBlock {
  return { id: makeId("txt"), type: "text", bodyMd };
}

export function extractText(blocks: ThreadBlock[]): string {
  return blocks
    .filter((b): b is z.infer<typeof TextBlockSchema> => b.type === "text")
    .map((b) => b.bodyMd)
    .join("\n\n")
    .trim();
}

export function deriveSubject(text: string): string {
  const firstLine = text.split(/\r?\n/)[0]?.trim() ?? "";
  return firstLine.slice(0, 80) || text.slice(0, 80);
}

interface ProjectStatsContext {
  productCount: number;
  availableCount: number;
  ordersLast30d: number;
  revenueLast30d: number;
  customerCount: number;
}

async function gatherProjectContext(): Promise<ProjectStatsContext> {
  const db = await getDb();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [productCount, availableCount, recentOrders, customerCount] =
    await Promise.all([
      db.product.count(),
      db.product.count({ where: { active: true, sold: false } }),
      db.order.findMany({
        where: {
          createdAt: { gte: since },
          status: { in: ["paid", "shipped", "delivered"] },
        },
        select: { total: true },
      }),
      db.customer.count(),
    ]);
  const revenue = recentOrders.reduce((s, o) => s + (o.total ?? 0), 0);
  return {
    productCount,
    availableCount,
    ordersLast30d: recentOrders.length,
    revenueLast30d: revenue,
    customerCount,
  };
}

interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
}

async function callClaude(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn("[manager-thread] ANTHROPIC_API_KEY missing — fallback reply");
    return null;
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: systemPrompt,
        messages,
      }),
    });
    if (!res.ok) {
      logger.warn(`[manager-thread] Anthropic ${res.status}`);
      return null;
    }
    const data = (await res.json()) as AnthropicMessageResponse;
    const text = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("\n")
      .trim();
    return text || null;
  } catch (err) {
    logger.error("[manager-thread] Anthropic call failed:", err);
    return null;
  }
}

function tryParseManagerJson(text: string): ThreadBlock[] | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch?.[1] ?? text;
  const objMatch = candidate.match(/\{[\s\S]*\}/);
  if (!objMatch) return null;
  try {
    const parsed = JSON.parse(objMatch[0]) as { blocks?: unknown };
    if (!parsed.blocks) return null;
    const result = ThreadBlocksSchema.safeParse(parsed.blocks);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

/**
 * Drive one ManagerThread from `pending` → `answered`. Acquires a soft lock by
 * flipping status to `processing`; the caller (cron route) is responsible for
 * preventing concurrent dispatch via DB query (`status='processing'` check).
 */
export async function processManagerThreadAnswer(
  threadId: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const db = await getDb();
  const thread = await db.managerThread.findUnique({
    where: { id: threadId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!thread) return { ok: false, error: "Thread nenalezen" };
  if (thread.status !== "pending") {
    return { ok: false, error: `Thread už není pending (${thread.status})` };
  }

  await db.managerThread.update({
    where: { id: threadId },
    data: { status: "processing" },
  });

  try {
    const ctx = await gatherProjectContext();
    const systemPrompt = [
      "Jsi manažerka eshopu Janička Shop (second-hand oblečení, CZ).",
      "Odpovídej česky, vřele, přímo, max 300 slov.",
      `Aktuální data: ${ctx.productCount} produktů (${ctx.availableCount} dostupných), `,
      `${ctx.ordersLast30d} objednávek za 30 dní (${Math.round(ctx.revenueLast30d)} Kč), `,
      `${ctx.customerCount} zákazníků.`,
      "",
      "Output STRIKTNĚ JSON: {\"blocks\": [...]}.",
      "Block typy: text {bodyMd}, chart {chartType:'bar'|'line'|'pie',title?,data:[{label,value}]}, table {headers:[],rows:[[]]}, actions {buttons:[{id,label,action,payload?}]}, poll {question,options:[{id,label}]}.",
      "Každý block musí mít unikátní 'id' a 'type'. Začni vždy text blockem.",
    ].join(" ");

    const apiMessages = thread.messages.map((m) => {
      const blocks = parseBlocks(m.contentJson);
      const text = extractText(blocks) || "(žádný text)";
      return {
        role: (m.role === "manager" ? "assistant" : "user") as
          | "user"
          | "assistant",
        content: text,
      };
    });

    const replyText = await callClaude(systemPrompt, apiMessages);
    let blocks: ThreadBlock[] | null = replyText
      ? tryParseManagerJson(replyText)
      : null;
    if (!blocks || blocks.length === 0) {
      // Fallback — wrap raw text or apology in a single text block so the
      // thread always lands in `answered` with renderable content.
      const fallback =
        replyText ??
        "Promiň, něco se mi rozbilo při odpovědi. Zkus prosím dotaz znovu nebo se zeptej bectlyho.";
      blocks = [textBlock(fallback)];
    }

    const message = await db.managerThreadMessage.create({
      data: {
        threadId,
        role: "manager",
        contentJson: JSON.stringify(blocks),
        imageKeys: "[]",
      },
    });

    await db.managerThread.update({
      where: { id: threadId },
      data: { status: "answered" },
    });

    return { ok: true, messageId: message.id };
  } catch (err) {
    logger.error("[manager-thread] processManagerThreadAnswer failed:", err);
    // Reset to pending so the next cron tick can retry; but only if no manager
    // reply was written (we don't want infinite-retry on a bug after success).
    await db.managerThread
      .update({ where: { id: threadId }, data: { status: "pending" } })
      .catch(() => undefined);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export const JANICKA_PROJECT_ID = 15;
