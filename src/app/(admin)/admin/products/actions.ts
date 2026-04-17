"use server";

import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { rateLimitAdmin } from "@/lib/rate-limit";
import { parseDefectImages, serializeDefectImages } from "@/lib/defects";
import { ALL_SIZES } from "@/lib/sizes";

const CONDITION_VALUES = [
  "new_with_tags",
  "new_without_tags",
  "excellent",
  "good",
  "visible_wear",
] as const;

/** Parse comma-separated sizes string → deduped array of enum-valid values. */
const sizesSchema = z
  .string()
  .max(500)
  .transform((raw) =>
    Array.from(
      new Set(
        raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ),
  )
  .pipe(
    z
      .array(z.enum(ALL_SIZES as unknown as [string, ...string[]]))
      .min(1, "Vyberte alespoň jednu velikost"),
  );

const productSchema = z.object({
  name: z.string().min(1, "Název je povinný").max(200),
  slug: z.string().min(1, "Slug je povinný").max(250),
  description: z.string().min(1, "Popis je povinný").max(5000),
  price: z.coerce.number().positive("Cena musí být kladná"),
  compareAt: z.coerce.number().positive().nullable(),
  sku: z.string().min(1, "SKU je povinné").max(50),
  categoryId: z.string().min(1, "Kategorie je povinná"),
  brand: z.string().max(100).nullable(),
  condition: z.enum(CONDITION_VALUES),
  sizes: sizesSchema,
  colors: z.string().max(500),
  featured: z.boolean(),
  active: z.boolean(),
}).refine(
  (data) => !data.compareAt || data.compareAt > data.price,
  { message: "Původní cena musí být vyšší než aktuální cena", path: ["compareAt"] },
);

const productImageSchema = z.object({
  url: z.string().url().refine(
    (u) => u.startsWith("https://") || u.startsWith("http://"),
    "Pouze HTTP/HTTPS URL",
  ),
  alt: z.string().max(200).default(""),
});

const imagesSchema = z.array(
  z.union([
    z.string().url(), // legacy string[] format
    productImageSchema, // new {url, alt}[] format
  ]),
).max(10);

function parseImages(formData: FormData): string {
  try {
    const raw = JSON.parse((formData.get("images") as string) || "[]");
    const parsed = imagesSchema.parse(raw);
    // Normalize to {url, alt}[] format
    const normalized = parsed.map((item) =>
      typeof item === "string" ? { url: item, alt: "" } : item,
    );
    return JSON.stringify(normalized);
  } catch {
    return "[]";
  }
}

function parseDefectsInput(formData: FormData): {
  note: string | null;
  images: string;
} {
  const rawNote = ((formData.get("defectsNote") as string) || "").trim();
  const note = rawNote ? rawNote.slice(0, 1000) : null;
  const rawImages = (formData.get("defectImages") as string) || "[]";
  const images = serializeDefectImages(parseDefectImages(rawImages));
  return { note, images };
}

function parseMeasurementsInput(formData: FormData): string {
  const measurements: Record<string, number> = {};
  for (const key of ["chest", "waist", "hips", "length"] as const) {
    const val = parseFloat(formData.get(`measurements_${key}`) as string);
    if (!isNaN(val) && val > 0) measurements[key] = val;
  }
  return JSON.stringify(measurements);
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

  const db = await getDb();

  // Ensure slug uniqueness
  let slug = parsed.slug;
  const existing = await db.product.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const validatedImages = parseImages(formData);
  const measurements = parseMeasurementsInput(formData);
  const { note: defectsNote, images: defectImages } = parseDefectsInput(formData);
  const fitNote = ((formData.get("fitNote") as string) || "").trim().slice(0, 120) || null;
  const rawVideoUrl = ((formData.get("videoUrl") as string) || "").trim();
  const videoUrl = rawVideoUrl && rawVideoUrl.length <= 2048 && /^https?:\/\//.test(rawVideoUrl) ? rawVideoUrl : null;

  const product = await db.product.create({
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
      sizes: JSON.stringify(parsed.sizes),
      colors: JSON.stringify(
        [...new Set(parsed.colors.split(",").map((s) => s.trim()).filter(Boolean))]
      ),
      images: validatedImages,
      measurements,
      defectsNote,
      defectImages,
      fitNote,
      videoUrl,
      stock: 1,
      featured: parsed.featured,
      active: parsed.active,
    },
  });

  // Log initial price for 30-day price history (Czech fake discount law)
  await db.priceHistory.create({
    data: { productId: product.id, price: parsed.price },
  });

  revalidateTag("products", "seconds");
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

  const db = await getDb();

  // Ensure slug uniqueness (skip self)
  let slug = parsed.slug;
  const existing = await db.product.findFirst({
    where: { slug, NOT: { id } },
  });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const validatedImages = parseImages(formData);
  const measurements = parseMeasurementsInput(formData);
  const { note: defectsNote, images: defectImages } = parseDefectsInput(formData);
  const fitNote = ((formData.get("fitNote") as string) || "").trim().slice(0, 120) || null;
  const rawVideoUrl = ((formData.get("videoUrl") as string) || "").trim();
  const videoUrl = rawVideoUrl && rawVideoUrl.length <= 2048 && /^https?:\/\//.test(rawVideoUrl) ? rawVideoUrl : null;

  // Check if price changed — log old price for 30-day price history (Czech fake discount law)
  const current = await db.product.findUnique({
    where: { id },
    select: { price: true },
  });
  if (current && current.price !== parsed.price) {
    await db.priceHistory.create({
      data: { productId: id, price: current.price },
    });
  }

  await db.product.update({
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
      sizes: JSON.stringify(parsed.sizes),
      colors: JSON.stringify(
        [...new Set(parsed.colors.split(",").map((s) => s.trim()).filter(Boolean))]
      ),
      images: validatedImages,
      measurements,
      defectsNote,
      defectImages,
      fitNote,
      videoUrl,
      featured: parsed.featured,
      active: parsed.active,
    },
  });

  revalidateTag("products", "seconds");
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
  condition: z.enum(CONDITION_VALUES),
  sizes: sizesSchema,
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

  const db = await getDb();

  // Auto-generate slug from name
  let slug = slugify(parsed.name);
  const existingSlug = await db.product.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // Auto-generate SKU: JN-<timestamp_base36>
  const sku = `JN-${Date.now().toString(36).toUpperCase()}`;

  const validatedImages = parseImages(formData);
  const measurements = parseMeasurementsInput(formData);
  const { note: defectsNote, images: defectImages } = parseDefectsInput(formData);
  const fitNote = ((formData.get("fitNote") as string) || "").trim().slice(0, 120) || null;
  const rawVideoUrl = ((formData.get("videoUrl") as string) || "").trim();
  const videoUrl = rawVideoUrl && rawVideoUrl.length <= 2048 && /^https?:\/\//.test(rawVideoUrl) ? rawVideoUrl : null;

  // Default description if empty
  const conditionLabel =
    parsed.condition === "new_with_tags"
      ? "nové s visačkou"
      : parsed.condition === "new_without_tags"
        ? "nové bez visačky"
        : parsed.condition === "excellent"
          ? "výborný"
          : parsed.condition === "good"
            ? "dobrý"
            : "viditelné opotřebení";
  const description = parsed.description.trim()
    || `${parsed.name}${parsed.brand ? ` od značky ${parsed.brand}` : ""}. Stav: ${conditionLabel}.`;

  const product = await db.product.create({
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
      sizes: JSON.stringify(parsed.sizes),
      colors: JSON.stringify(
        [...new Set(parsed.colors.split(",").map((s) => s.trim()).filter(Boolean))]
      ),
      images: validatedImages,
      measurements,
      defectsNote,
      defectImages,
      fitNote,
      videoUrl,
      stock: 1,
      featured: false,
      active: true,
    },
  });

  // Log initial price for 30-day price history (Czech fake discount law)
  await db.priceHistory.create({
    data: { productId: product.id, price: parsed.price },
  });

  revalidateTag("products", "seconds");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/admin/products");
}

export async function duplicateProduct(id: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();
  const source = await db.product.findUnique({ where: { id } });
  if (!source) throw new Error("Produkt nenalezen");

  // Generate unique slug and SKU for the copy
  const baseName = `${source.name} (kopie)`;
  let slug = slugify(baseName);
  const existingSlug = await db.product.findUnique({ where: { slug } });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }
  const sku = `JN-${Date.now().toString(36).toUpperCase()}`;

  const copy = await db.product.create({
    data: {
      name: baseName,
      slug,
      description: source.description,
      price: source.price,
      compareAt: source.compareAt,
      sku,
      categoryId: source.categoryId,
      brand: source.brand,
      condition: source.condition,
      sizes: source.sizes,
      colors: source.colors,
      images: source.images,
      measurements: source.measurements,
      defectsNote: source.defectsNote,
      defectImages: source.defectImages,
      fitNote: source.fitNote,
      videoUrl: source.videoUrl,
      stock: 1,
      featured: false,
      active: false, // Start hidden so admin can review before publishing
      sold: false,
    },
  });

  // Log initial price for 30-day price history
  await db.priceHistory.create({
    data: { productId: copy.id, price: copy.price },
  });

  revalidateTag("products", "seconds");
  revalidatePath("/admin/products");
  redirect(`/admin/products/${copy.id}/edit`);
}

// ── Bulk actions ────────────────────────────────────────

const bulkActionSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["activate", "hide", "feature", "unfeature", "delete"]),
});

export async function bulkUpdateProducts(ids: string[], action: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const parsed = bulkActionSchema.parse({ ids, action });
  const db = await getDb();

  let affected = 0;

  switch (parsed.action) {
    case "activate": {
      const res = await db.product.updateMany({
        where: { id: { in: parsed.ids } },
        data: { active: true, sold: false },
      });
      affected = res.count;
      break;
    }

    case "hide": {
      const res = await db.product.updateMany({
        where: { id: { in: parsed.ids } },
        data: { active: false },
      });
      affected = res.count;
      break;
    }

    case "feature": {
      const res = await db.product.updateMany({
        where: { id: { in: parsed.ids } },
        data: { featured: true },
      });
      affected = res.count;
      break;
    }

    case "unfeature": {
      const res = await db.product.updateMany({
        where: { id: { in: parsed.ids } },
        data: { featured: false },
      });
      affected = res.count;
      break;
    }

    case "delete": {
      // Find which products have associated order items (must soft-delete)
      const withOrders = await db.orderItem.findMany({
        where: { productId: { in: parsed.ids } },
        select: { productId: true },
        distinct: ["productId"],
      });
      const withOrderIds = new Set(withOrders.map((o) => o.productId));
      const hardDeleteIds = parsed.ids.filter((id) => !withOrderIds.has(id));
      const softDeleteIds = parsed.ids.filter((id) => withOrderIds.has(id));

      const [softRes, hardRes] = await Promise.all([
        softDeleteIds.length > 0
          ? db.product.updateMany({
              where: { id: { in: softDeleteIds } },
              data: { active: false, sold: true },
            })
          : Promise.resolve({ count: 0 }),
        hardDeleteIds.length > 0
          ? db.product.deleteMany({ where: { id: { in: hardDeleteIds } } })
          : Promise.resolve({ count: 0 }),
      ]);
      affected = softRes.count + hardRes.count;
      break;
    }
  }

  revalidateTag("products", "seconds");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");

  return { affected };
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();

  // Check if product has order items — if so, soft-delete to preserve order history
  const orderItemCount = await db.orderItem.count({
    where: { productId: id },
  });

  if (orderItemCount > 0) {
    await db.product.update({
      where: { id },
      data: { active: false, sold: true },
    });
  } else {
    await db.product.delete({ where: { id } });
  }

  revalidateTag("products", "seconds");
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
}
