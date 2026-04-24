"use server";

import { revalidateTag } from "next/cache";
import { getDb } from "@/lib/db";
import { z } from "zod";
import { rateLimitNewsletter } from "@/lib/rate-limit";
import { sendNewsletterWelcomeEmail } from "@/lib/email";
import { logger } from "@/lib/logger";

const newsletterSchema = z.object({
  email: z.string().trim().email("Zadejte platný e-mail").max(254),
});

export async function subscribeNewsletter(
  _prev: { success: boolean; message: string } | null,
  formData: FormData,
): Promise<{ success: boolean; message: string }> {
  // Rate limit: 3 subscriptions per minute per IP
  const rl = await rateLimitNewsletter();
  if (!rl.success) {
    return {
      success: false,
      message: "Příliš mnoho pokusů. Zkuste to prosím za chvíli.",
    };
  }

  const parsed = newsletterSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { success: false, message: "Zadejte platný e-mail." };
  }

  // Normalize email to lowercase — SQLite unique lookups are case-sensitive,
  // so "User@Example.com" and "user@example.com" would be two different records.
  // Normalizing at write time ensures consistent unsubscribe and duplicate detection.
  const email = parsed.data.email.toLowerCase();

  try {
    const db = await getDb();
    // Check if this is a new subscriber (not a re-subscribe)
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
      select: { active: true },
    });
    const isNew = !existing || !existing.active;

    await db.newsletterSubscriber.upsert({
      where: { email },
      create: { email, active: true, source: "website" },
      update: { active: true },
    });
    revalidateTag("admin-subscribers", "max");

    // Send welcome email only for new subscribers (fire-and-forget)
    if (isNew) {
      sendNewsletterWelcomeEmail(email).catch((err) => {
        logger.error(`[Newsletter] Welcome email failed for ${email}:`, err);
      });
    }

    return {
      success: true,
      message: "Děkujeme za přihlášení! Brzy se ozveme.",
    };
  } catch {
    return {
      success: false,
      message: "Něco se pokazilo. Zkuste to prosím znovu.",
    };
  }
}

/**
 * Update newsletter subscriber preferences (sizes, categories, brands).
 * Used for progressive profiling — e.g., on 2nd visit or preference page.
 */
export async function updateSubscriberPreferences(input: {
  email: string;
  firstName?: string;
  preferredSizes?: string[];
  preferredCategories?: string[];
  preferredBrands?: string[];
}): Promise<{ success: boolean }> {
  const emailParsed = z.string().email().max(254).safeParse(input.email);
  if (!emailParsed.success) return { success: false };

  try {
    const db = await getDb();
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email: emailParsed.data },
    });
    if (!existing) return { success: false };

    await db.newsletterSubscriber.update({
      where: { email: emailParsed.data },
      data: {
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.preferredSizes
          ? { preferredSizes: JSON.stringify(input.preferredSizes) }
          : {}),
        ...(input.preferredCategories
          ? { preferredCategories: JSON.stringify(input.preferredCategories) }
          : {}),
        ...(input.preferredBrands
          ? { preferredBrands: JSON.stringify(input.preferredBrands) }
          : {}),
      },
    });

    return { success: true };
  } catch {
    return { success: false };
  }
}

// ---------------------------------------------------------------------------
// Style quiz (/kviz/styl) — captures email + size/condition/color/price
// preferences, subscribes to newsletter, returns prefilled /products URL.
// ---------------------------------------------------------------------------

const QUIZ_STYLES = ["casual", "elegant", "street", "boho", "minimal"] as const;
const QUIZ_CONDITIONS = ["new_only", "any"] as const;

const styleQuizSchema = z.object({
  email: z.string().trim().email("Zadejte platný e-mail").max(254),
  sizes: z.array(z.string().max(16)).max(12).default([]),
  style: z.enum(QUIZ_STYLES),
  conditionTolerance: z.enum(QUIZ_CONDITIONS),
  colors: z.array(z.string().max(32)).max(10).default([]),
  maxPrice: z.number().int().min(0).max(999999).nullable(),
});

export type StyleQuizInput = z.infer<typeof styleQuizSchema>;

export async function submitStyleQuiz(
  _prev: { success: boolean; message: string; redirectUrl?: string } | null,
  formData: FormData,
): Promise<{ success: boolean; message: string; redirectUrl?: string }> {
  const rl = await rateLimitNewsletter();
  if (!rl.success) {
    return {
      success: false,
      message: "Příliš mnoho pokusů. Zkuste to prosím za chvíli.",
    };
  }

  const rawSizes = formData.getAll("sizes").map(String).filter(Boolean);
  const rawColors = formData.getAll("colors").map(String).filter(Boolean);
  const rawMaxPrice = formData.get("maxPrice");
  const parsedMaxPrice =
    typeof rawMaxPrice === "string" && rawMaxPrice.trim() !== ""
      ? Number(rawMaxPrice)
      : null;

  const parsed = styleQuizSchema.safeParse({
    email: formData.get("email"),
    sizes: rawSizes,
    style: formData.get("style"),
    conditionTolerance: formData.get("conditionTolerance"),
    colors: rawColors,
    maxPrice: Number.isFinite(parsedMaxPrice) ? parsedMaxPrice : null,
  });

  if (!parsed.success) {
    return { success: false, message: "Vyplňte prosím všechny otázky a platný e-mail." };
  }

  const allowedSizes = new Set(ALL_SIZES);
  const allowedColors = new Set(Object.keys(COLOR_MAP));
  const sizes = parsed.data.sizes.filter((s) => allowedSizes.has(s));
  const colors = parsed.data.colors.filter((c) => allowedColors.has(c));

  const email = parsed.data.email.toLowerCase();

  try {
    const db = await getDb();
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
      select: { active: true },
    });
    const isNew = !existing || !existing.active;

    await db.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        active: true,
        source: "kviz-styl",
        preferredSizes: sizes.length ? JSON.stringify(sizes) : null,
      },
      update: {
        active: true,
        ...(sizes.length ? { preferredSizes: JSON.stringify(sizes) } : {}),
      },
    });
    revalidateTag("admin-subscribers", "max");

    if (isNew) {
      sendNewsletterWelcomeEmail(email).catch((err) => {
        logger.error(`[StyleQuiz] Welcome email failed for ${email}:`, err);
      });
    }
  } catch (err) {
    logger.error("[StyleQuiz] DB error:", err);
    return {
      success: false,
      message: "Něco se pokazilo. Zkuste to prosím znovu.",
    };
  }

  // Build prefilled /products URL — only real catalog filters.
  const sp = new URLSearchParams();
  for (const s of sizes) sp.append("size", s);
  for (const c of colors) sp.append("color", c);
  if (parsed.data.conditionTolerance === "new_only") {
    sp.append("condition", "new_with_tags");
    sp.append("condition", "new_without_tags");
  }
  if (parsed.data.maxPrice !== null) {
    sp.set("maxPrice", String(parsed.data.maxPrice));
  }
  const qs = sp.toString();
  const redirectUrl = qs ? `/products?${qs}` : "/products";

  return {
    success: true,
    message: "Hotovo! Připravujeme váš výběr…",
    redirectUrl,
  };
}

/**
 * Fetch cross-sell product recommendations for the cart page.
 * Returns up to 4 available products from the same categories as cart items,
 * excluding the cart items themselves.
 */
export async function getCartRecommendations(
  productIds: string[],
): Promise<
  {
    id: string;
    name: string;
    slug: string;
    price: number;
    compareAt: number | null;
    images: string;
    categoryName: string;
    brand: string | null;
    condition: string;
    sizes: string;
    colors: string;
    stock: number;
    createdAt: string;
  }[]
> {
  if (productIds.length === 0) return [];

  // Cap input to prevent abuse
  const safeIds = productIds.slice(0, 20);

  const db = await getDb();
  // Get category IDs for the cart items
  const cartProducts = await db.product.findMany({
    where: { id: { in: safeIds } },
    select: { categoryId: true },
  });

  const categoryIds = [...new Set(cartProducts.map((p) => p.categoryId))];
  if (categoryIds.length === 0) return [];

  // Fetch candidates from same categories, excluding cart items
  const candidates = await db.product.findMany({
    where: {
      categoryId: { in: categoryIds },
      id: { notIn: safeIds },
      active: true,
      sold: false,
    },
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 4,
  });

  return candidates.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAt: p.compareAt,
    images: p.images,
    categoryName: p.category.name,
    brand: p.brand,
    condition: p.condition,
    sizes: p.sizes,
    colors: p.colors,
    stock: p.stock,
    createdAt: p.createdAt.toISOString(),
  }));
}
