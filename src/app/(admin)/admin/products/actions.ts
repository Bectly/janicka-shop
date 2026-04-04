"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { rateLimitAdmin } from "@/lib/rate-limit";

const productSchema = z.object({
  name: z.string().min(1, "Název je povinný").max(200),
  slug: z.string().min(1, "Slug je povinný").max(250),
  description: z.string().min(1, "Popis je povinný").max(5000),
  price: z.coerce.number().positive("Cena musí být kladná"),
  compareAt: z.coerce.number().positive().nullable(),
  sku: z.string().min(1, "SKU je povinné").max(50),
  categoryId: z.string().min(1, "Kategorie je povinná"),
  brand: z.string().max(100).nullable(),
  condition: z.enum(["new_with_tags", "excellent", "good", "visible_wear"]),
  sizes: z.string().max(500),
  colors: z.string().max(500),
  featured: z.boolean(),
  active: z.boolean(),
}).refine(
  (data) => !data.compareAt || data.compareAt > data.price,
  { message: "Původní cena musí být vyšší než aktuální cena", path: ["compareAt"] },
);

const imagesSchema = z.array(
  z.string().url().refine(
    (u) => u.startsWith("https://") || u.startsWith("http://"),
    "Pouze HTTP/HTTPS URL",
  ),
).max(10);

function parseImages(formData: FormData): string {
  try {
    const parsed = imagesSchema.parse(JSON.parse((formData.get("images") as string) || "[]"));
    return JSON.stringify(parsed);
  } catch {
    return "[]";
  }
}

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
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

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
    active: formData.get("active") === "on",
  };

  const parsed = productSchema.parse(raw);

  // Ensure slug uniqueness
  let slug = parsed.slug;
  const existing = await prisma.product.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const validatedImages = parseImages(formData);

  const product = await prisma.product.create({
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
        [...new Set(parsed.sizes.split(",").map((s) => s.trim()).filter(Boolean))]
      ),
      colors: JSON.stringify(
        [...new Set(parsed.colors.split(",").map((s) => s.trim()).filter(Boolean))]
      ),
      images: validatedImages,
      stock: 1,
      featured: parsed.featured,
      active: parsed.active,
    },
  });

  // Log initial price for 30-day price history (Czech fake discount law)
  await prisma.priceHistory.create({
    data: { productId: product.id, price: parsed.price },
  });

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/admin/products");
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

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
    active: formData.get("active") === "on",
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

  const validatedImages = parseImages(formData);

  // Check if price changed — log old price for 30-day price history (Czech fake discount law)
  const current = await prisma.product.findUnique({
    where: { id },
    select: { price: true },
  });
  if (current && current.price !== parsed.price) {
    await prisma.priceHistory.create({
      data: { productId: id, price: current.price },
    });
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
        [...new Set(parsed.sizes.split(",").map((s) => s.trim()).filter(Boolean))]
      ),
      colors: JSON.stringify(
        [...new Set(parsed.colors.split(",").map((s) => s.trim()).filter(Boolean))]
      ),
      images: validatedImages,
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

/** Quick-add: minimal fields for fast mobile product creation */
const quickProductSchema = z.object({
  name: z.string().min(1, "Název je povinný").max(200),
  price: z.coerce.number().positive("Cena musí být kladná"),
  compareAt: z.coerce.number().positive().nullable(),
  categoryId: z.string().min(1, "Kategorie je povinná"),
  brand: z.string().max(100).nullable(),
  condition: z.enum(["new_with_tags", "excellent", "good", "visible_wear"]),
  sizes: z.string().min(1, "Velikost je povinná").max(500),
  colors: z.string().max(500),
  description: z.string().max(5000),
}).refine(
  (data) => !data.compareAt || data.compareAt > data.price,
  { message: "Původní cena musí být vyšší než aktuální cena", path: ["compareAt"] },
);

export async function quickCreateProduct(formData: FormData) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const raw = {
    name: formData.get("name") as string,
    price: formData.get("price"),
    compareAt: formData.get("compareAt") || null,
    categoryId: formData.get("categoryId") as string,
    brand: (formData.get("brand") as string) || null,
    condition: (formData.get("condition") as string) || "excellent",
    sizes: (formData.get("sizes") as string) || "",
    colors: (formData.get("colors") as string) || "",
    description: (formData.get("description") as string) || "",
  };

  const parsed = quickProductSchema.parse(raw);

  // Auto-generate slug from name
  let slug = slugify(parsed.name);
  const existingSlug = await prisma.product.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Auto-generate SKU: JN-<timestamp_base36>
  const sku = `JN-${Date.now().toString(36).toUpperCase()}`;

  const validatedImages = parseImages(formData);

  // Default description if empty
  const description = parsed.description.trim()
    || `${parsed.name}${parsed.brand ? ` od značky ${parsed.brand}` : ""}. Stav: ${parsed.condition === "new_with_tags" ? "nové s visačkou" : parsed.condition === "excellent" ? "výborný" : parsed.condition === "good" ? "dobrý" : "viditelné opotřebení"}.`;

  const product = await prisma.product.create({
    data: {
      name: parsed.name,
      slug,
      description,
      price: parsed.price,
      compareAt: parsed.compareAt,
      sku,
      categoryId: parsed.categoryId,
      brand: parsed.brand,
      condition: parsed.condition,
      sizes: JSON.stringify(
        [...new Set(parsed.sizes.split(",").map((s) => s.trim()).filter(Boolean))]
      ),
      colors: JSON.stringify(
        [...new Set(parsed.colors.split(",").map((s) => s.trim()).filter(Boolean))]
      ),
      images: validatedImages,
      stock: 1,
      featured: false,
      active: true,
    },
  });

  // Log initial price for 30-day price history (Czech fake discount law)
  await prisma.priceHistory.create({
    data: { productId: product.id, price: parsed.price },
  });

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/admin/products");
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  // Check if product has order items — if so, soft-delete to preserve order history
  const orderItemCount = await prisma.orderItem.count({
    where: { productId: id },
  });

  if (orderItemCount > 0) {
    await prisma.product.update({
      where: { id },
      data: { active: false, sold: true },
    });
  } else {
    await prisma.product.delete({ where: { id } });
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
}
