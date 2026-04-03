"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1, "Název je povinný"),
  slug: z.string().min(1, "Slug je povinný"),
  description: z.string().min(1, "Popis je povinný"),
  price: z.coerce.number().positive("Cena musí být kladná"),
  compareAt: z.coerce.number().positive().nullable(),
  sku: z.string().min(1, "SKU je povinné"),
  categoryId: z.string().min(1, "Kategorie je povinná"),
  brand: z.string().nullable(),
  condition: z.enum(["new_with_tags", "excellent", "good", "visible_wear"]),
  sizes: z.string(),
  colors: z.string(),
  featured: z.boolean(),
  active: z.boolean(),
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

export async function createProduct(formData: FormData) {
  await requireAdmin();

  const raw = {
    name: formData.get("name") as string,
    slug: slugify(formData.get("name") as string),
    description: formData.get("description") as string,
    price: formData.get("price"),
    compareAt: formData.get("compareAt") || null,
    sku: formData.get("sku") as string,
    categoryId: formData.get("categoryId") as string,
    brand: (formData.get("brand") as string) || null,
    condition: formData.get("condition") as string,
    sizes: formData.get("sizes") as string,
    colors: formData.get("colors") as string,
    featured: formData.get("featured") === "on",
    active: formData.get("active") !== "off",
  };

  const parsed = productSchema.parse(raw);

  // Ensure slug uniqueness
  let slug = parsed.slug;
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  await prisma.product.create({
    data: {
      name: parsed.name,
      slug,
      description: parsed.description,
      price: parsed.price,
      compareAt: parsed.compareAt,
      sku: parsed.sku,
      categoryId: parsed.categoryId,
      brand: parsed.brand,
      condition: parsed.condition,
      sizes: JSON.stringify(
        parsed.sizes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      ),
      colors: JSON.stringify(
        parsed.colors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      ),
      images: "[]",
      stock: 1,
      featured: parsed.featured,
      active: parsed.active,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/admin/products");
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();

  const raw = {
    name: formData.get("name") as string,
    slug: slugify(formData.get("name") as string),
    description: formData.get("description") as string,
    price: formData.get("price"),
    compareAt: formData.get("compareAt") || null,
    sku: formData.get("sku") as string,
    categoryId: formData.get("categoryId") as string,
    brand: (formData.get("brand") as string) || null,
    condition: formData.get("condition") as string,
    sizes: formData.get("sizes") as string,
    colors: formData.get("colors") as string,
    featured: formData.get("featured") === "on",
    active: formData.get("active") !== "off",
  };

  const parsed = productSchema.parse(raw);

  // Ensure slug uniqueness (skip self)
  let slug = parsed.slug;
  const existing = await prisma.product.findFirst({
    where: { slug, NOT: { id } },
  });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  await prisma.product.update({
    where: { id },
    data: {
      name: parsed.name,
      slug,
      description: parsed.description,
      price: parsed.price,
      compareAt: parsed.compareAt,
      sku: parsed.sku,
      categoryId: parsed.categoryId,
      brand: parsed.brand,
      condition: parsed.condition,
      sizes: JSON.stringify(
        parsed.sizes
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      ),
      colors: JSON.stringify(
        parsed.colors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      ),
      featured: parsed.featured,
      active: parsed.active,
    },
  });

  revalidatePath("/admin/products");
  revalidatePath(`/products/${slug}`);
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/admin/products");
}

export async function deleteProduct(id: string) {
  await requireAdmin();

  await prisma.product.delete({ where: { id } });

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
}
