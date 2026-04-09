"use server";

import { getDb } from "@/lib/db";
import { z } from "zod";
import { rateLimitNewsletter } from "@/lib/rate-limit";
import { sendNewsletterWelcomeEmail } from "@/lib/email";

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

    // Send welcome email only for new subscribers (fire-and-forget)
    if (isNew) {
      sendNewsletterWelcomeEmail(email).catch((err) => {
        console.error(`[Newsletter] Welcome email failed for ${email}:`, err);
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
  }));
}
