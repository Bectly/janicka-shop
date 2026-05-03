"use server";

import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/require-admin";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

const collectionSchema = z.object({
  title: z.string().min(1, "Název je povinný").max(200),
  description: z.string().max(2000).optional(),
  slug: z.string().max(200).optional(),
  image: z.string().regex(/^https?:\/\//, "URL obrázku musí začínat https://").max(2000).optional(),
  productIds: z.array(z.string().max(128)).max(200).default([]),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  active: z.boolean().default(true),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(),
});

export type CollectionFormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

export async function createCollection(
  _prev: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  await requireAdmin();
  const raw = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    slug: (formData.get("slug") as string) || undefined,
    image: (formData.get("image") as string) || undefined,
    productIds: (() => { try { return JSON.parse((formData.get("productIds") as string) || "[]"); } catch { return []; } })(),
    featured: formData.get("featured") === "true",
    sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    active: formData.get("active") !== "false",
    startDate: (formData.get("startDate") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
  };

  const result = collectionSchema.safeParse(raw);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: null, fieldErrors };
  }

  const data = result.data;
  const slug = data.slug || slugify(data.title);

  const db = await getDb();

  // Check for slug uniqueness
  const existing = await db.collection.findUnique({ where: { slug } });
  if (existing) {
    return { error: null, fieldErrors: { slug: "Tento slug už existuje" } };
  }

  await db.collection.create({
    data: {
      title: data.title,
      description: data.description ?? "",
      slug,
      image: data.image ?? null,
      productIds: JSON.stringify(data.productIds),
      featured: data.featured,
      sortOrder: data.sortOrder,
      active: data.active,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  });

  revalidateTag("admin-collections", "max");
  revalidatePath("/admin/collections");
  revalidatePath("/");
  redirect("/admin/collections");
}

export async function updateCollection(
  id: string,
  _prev: CollectionFormState,
  formData: FormData,
): Promise<CollectionFormState> {
  await requireAdmin();
  const raw = {
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    slug: (formData.get("slug") as string) || undefined,
    image: (formData.get("image") as string) || undefined,
    productIds: (() => { try { return JSON.parse((formData.get("productIds") as string) || "[]"); } catch { return []; } })(),
    featured: formData.get("featured") === "true",
    sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    active: formData.get("active") !== "false",
    startDate: (formData.get("startDate") as string) || undefined,
    endDate: (formData.get("endDate") as string) || undefined,
  };

  const result = collectionSchema.safeParse(raw);
  if (!result.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: null, fieldErrors };
  }

  const data = result.data;
  const slug = data.slug || slugify(data.title);

  const db = await getDb();

  // Fetch current collection to get the old slug for cache revalidation
  const current = await db.collection.findUnique({ where: { id }, select: { slug: true } });

  // Check slug uniqueness (exclude self)
  const existing = await db.collection.findFirst({
    where: { slug, NOT: { id } },
  });
  if (existing) {
    return { error: null, fieldErrors: { slug: "Tento slug už existuje" } };
  }

  await db.collection.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description ?? "",
      slug,
      image: data.image ?? null,
      productIds: JSON.stringify(data.productIds),
      featured: data.featured,
      sortOrder: data.sortOrder,
      active: data.active,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  });

  revalidateTag("admin-collections", "max");
  revalidatePath("/admin/collections");
  // Revalidate new slug page
  revalidatePath(`/collections/${slug}`);
  // Also revalidate old slug page if slug changed, so stale cache is cleared
  if (current && current.slug !== slug) {
    revalidatePath(`/collections/${current.slug}`);
  }
  revalidatePath("/");
  redirect("/admin/collections");
}

export async function deleteCollection(id: string): Promise<void> {
  await requireAdmin();
  const db = await getDb();
  const collection = await db.collection.findUnique({ where: { id } });
  await db.collection.delete({ where: { id } });
  revalidateTag("admin-collections", "max");
  revalidatePath("/admin/collections");
  if (collection) revalidatePath(`/collections/${collection.slug}`);
  revalidatePath("/");
}
