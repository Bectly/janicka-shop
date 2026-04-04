"use server";

import { prisma } from "@/lib/db";
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

  const { email } = parsed.data;

  try {
    // Check if this is a new subscriber (not a re-subscribe)
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
      select: { active: true },
    });
    const isNew = !existing || !existing.active;

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, active: true },
      update: { active: true },
    });

    // Send welcome email only for new subscribers (fire-and-forget)
    if (isNew) {
      sendNewsletterWelcomeEmail(email);
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

  // Get category IDs for the cart items
  const cartProducts = await prisma.product.findMany({
    where: { id: { in: safeIds } },
    select: { categoryId: true },
  });

  const categoryIds = [...new Set(cartProducts.map((p) => p.categoryId))];
  if (categoryIds.length === 0) return [];

  // Fetch candidates from same categories, excluding cart items
  const candidates = await prisma.product.findMany({
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
