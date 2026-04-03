"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { rateLimitAdmin } from "@/lib/rate-limit";

const categorySchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  slug: z.string().min(1, "Slug je povinný"),
  description: z.string().nullable(),
  image: z.string().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
}

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const raw = {
    name: formData.get("name") as string,
    slug: slugify(formData.get("name") as string),
    description: (formData.get("description") as string) || null,
    image: (formData.get("image") as string) || null,
    sortOrder: formData.get("sortOrder") || 0,
  };

  const parsed = categorySchema.parse(raw);

  // Check slug uniqueness
  let slug = parsed.slug;
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Check name uniqueness
  const nameExists = await prisma.category.findUnique({
    where: { name: parsed.name },
  });
  if (nameExists) {
    throw new Error("Kategorie s tímto názvem již existuje");
  }

  await prisma.category.create({
    data: {
      name: parsed.name,
      slug,
      description: parsed.description,
      image: parsed.image,
      sortOrder: parsed.sortOrder,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  revalidatePath("/");
}

export async function updateCategory(id: string, formData: FormData) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const raw = {
    name: formData.get("name") as string,
    slug: slugify(formData.get("name") as string),
    description: (formData.get("description") as string) || null,
    image: (formData.get("image") as string) || null,
    sortOrder: formData.get("sortOrder") || 0,
  };

  const parsed = categorySchema.parse(raw);

  // Check slug uniqueness (skip self)
  let slug = parsed.slug;
  const existingSlug = await prisma.category.findFirst({
    where: { slug, NOT: { id } },
  });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Check name uniqueness (skip self)
  const nameExists = await prisma.category.findFirst({
    where: { name: parsed.name, NOT: { id } },
  });
  if (nameExists) {
    throw new Error("Kategorie s tímto názvem již existuje");
  }

  await prisma.category.update({
    where: { id },
    data: {
      name: parsed.name,
      slug,
      description: parsed.description,
      image: parsed.image,
      sortOrder: parsed.sortOrder,
    },
  });

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  revalidatePath("/");
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  // Check if category has products — prevent deletion to avoid orphans
  const productCount = await prisma.product.count({
    where: { categoryId: id },
  });

  if (productCount > 0) {
    throw new Error(
      `Nelze smazat — kategorie obsahuje ${productCount} ${productCount === 1 ? "produkt" : productCount >= 2 && productCount <= 4 ? "produkty" : "produktů"}. Nejdříve přesuňte produkty do jiné kategorie.`,
    );
  }

  await prisma.category.delete({ where: { id } });

  revalidatePath("/admin/categories");
  revalidatePath("/products");
  revalidatePath("/");
}
