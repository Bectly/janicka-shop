"use server";

import { getDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";
import { after } from "next/server";
import { invalidateProductCaches } from "@/lib/redis";
import { redirect } from "next/navigation";
import { z } from "zod";
import { rateLimitAdmin } from "@/lib/rate-limit";
import { parseDefectImages, serializeDefectImages } from "@/lib/defects";
import { ALL_SIZES } from "@/lib/sizes";
import { computeBulkPrice } from "./bulk-price";

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

function parseSeoAndNote(formData: FormData): {
  metaTitle: string | null;
  metaDescription: string | null;
  internalNote: string | null;
} {
  const rawTitle = ((formData.get("metaTitle") as string) || "").trim();
  const rawDesc = ((formData.get("metaDescription") as string) || "").trim();
  const rawNote = ((formData.get("internalNote") as string) || "").trim();
  return {
    metaTitle: rawTitle ? rawTitle.slice(0, 70) : null,
    metaDescription: rawDesc ? rawDesc.slice(0, 160) : null,
    internalNote: rawNote ? rawNote.slice(0, 2000) : null,
  };
}

const VINTED_HOST_RE = /(?:^|\.)vinted\.(net|com)$/i;

function rejectVintedHost(u: string): boolean {
  try {
    return !VINTED_HOST_RE.test(new URL(u).hostname);
  } catch {
    return false;
  }
}

const productImageSchema = z.object({
  url: z
    .string()
    .url()
    .refine(
      (u) => u.startsWith("https://") || u.startsWith("http://"),
      "Pouze HTTP/HTTPS URL",
    )
    .refine(rejectVintedHost, "Fotky hostované na Vinted nejsou povolené — musí být nahrané do našeho úložiště"),
  alt: z.string().max(200).default(""),
  caption: z.string().max(300).optional(),
});

const imagesSchema = z.array(
  z.union([
    z.string().url().refine(rejectVintedHost, "Fotky hostované na Vinted nejsou povolené — musí být nahrané do našeho úložiště"),
    productImageSchema, // new {url, alt}[] format
  ]),
).max(10);

function parseImages(formData: FormData): string {
  try {
    const raw = JSON.parse((formData.get("images") as string) || "[]");
    const parsed = imagesSchema.parse(raw);
    // Normalize to {url, alt[, caption]}[] format
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
  for (const key of ["chest", "waist", "hips", "length", "sleeve", "inseam"] as const) {
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

  const rawSku = ((formData.get("sku") as string) || "").trim();
  const sku = rawSku || `JN-${Date.now().toString(36).toUpperCase()}`;

  const raw = {
    name: formData.get("name") as string,
    slug: slugify(formData.get("name") as string),
    description: formData.get("description") as string,
    price: formData.get("price"),
    compareAt: formData.get("compareAt") || null,
    sku,
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
  const seo = parseSeoAndNote(formData);

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
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      internalNote: seo.internalNote,
      stock: 1,
      featured: parsed.featured,
      active: parsed.active,
    },
  });

  // Log initial price for 30-day price history (Czech fake discount law)
  await db.priceHistory.create({
    data: { productId: product.id, price: parsed.price },
  });

  // Best-effort: kick off Gemini alt-text generation for any newly-uploaded images
  // that lack alt. Fire-and-forget so admin redirect isn't blocked by the API call.
  if (process.env.GEMINI_API_KEY) {
    const productId = product.id;
    after(async () => {
      try {
        await backfillAltTextInternal(productId);
      } catch {
        /* best-effort — log already inside */
      }
    });
  }

  revalidateTag("products", "max");
  revalidateTag("admin-products", "max");
  await invalidateProductCaches({ slug: product.slug, id: product.id });
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
  const seo = parseSeoAndNote(formData);

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
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      internalNote: seo.internalNote,
      featured: parsed.featured,
      active: parsed.active,
    },
  });

  revalidateTag("products", "max");
  revalidateTag("admin-products", "max");
  await invalidateProductCaches({ slug, id });
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
  featured: z.boolean().default(false),
  metaTitle: z.string().max(70).nullable(),
  metaDescription: z.string().max(160).nullable(),
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
    featured: formData.get("featured") === "on" || formData.get("featured") === "true",
    metaTitle: ((formData.get("metaTitle") as string) || "").trim() || null,
    metaDescription: ((formData.get("metaDescription") as string) || "").trim() || null,
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
      featured: parsed.featured,
      active: true,
      metaTitle: parsed.metaTitle,
      metaDescription: parsed.metaDescription,
    },
  });

  // Log initial price for 30-day price history (Czech fake discount law)
  await db.priceHistory.create({
    data: { productId: product.id, price: parsed.price },
  });

  // Quick-add path: auto-generate alt-text for fresh uploads. Mobile admins
  // rarely write alt manually — Gemini fills this gap so SEO/a11y survives.
  if (process.env.GEMINI_API_KEY) {
    const productId = product.id;
    after(async () => {
      try {
        await backfillAltTextInternal(productId);
      } catch {
        /* best-effort — log already inside */
      }
    });
  }

  revalidateTag("products", "max");
  revalidateTag("admin-products", "max");
  await invalidateProductCaches({ slug: product.slug, id: product.id });
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
  redirect("/admin/products?added=1");
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

  revalidateTag("products", "max");
  revalidateTag("admin-products", "max");
  await invalidateProductCaches({ slug: copy.slug, id: copy.id });
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

  revalidateTag("products", "max");
  revalidateTag("admin-products", "max");
  await invalidateProductCaches();
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");

  return { affected };
}

// ── Bulk price change ────────────────────────────────────────
//
// Three modes:
//   - "absolute": set all selected products to `value` (CZK)
//   - "percent": reduce current price by `value` % (e.g. 20 = -20%)
//   - "add": add `value` CZK to current price (can be negative)
//
// Writes a PriceHistory row per product whose price actually changed
// (30-day lowest-price rule — Czech "fake discount" law).

const bulkPriceSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  mode: z.enum(["absolute", "percent", "add"]),
  value: z.number().finite(),
});

export async function bulkUpdatePrice(
  ids: string[],
  mode: string,
  value: number,
): Promise<{ affected: number }> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const parsed = bulkPriceSchema.parse({ ids, mode, value });
  const db = await getDb();

  const products = await db.product.findMany({
    where: { id: { in: parsed.ids } },
    select: { id: true, slug: true, price: true },
  });

  let affected = 0;
  for (const p of products) {
    const next = computeBulkPrice(p.price, parsed.mode, parsed.value);
    if (next === p.price) continue;
    // Log OLD price to price history BEFORE updating (30-day lowest-price rule)
    await db.priceHistory.create({
      data: { productId: p.id, price: p.price },
    });
    await db.product.update({
      where: { id: p.id },
      data: { price: next },
    });
    revalidateTag(`product-${p.slug}`, "max");
    affected++;
  }

  revalidateTag("products", "max");
  revalidateTag("admin-products", "max");
  await Promise.all(products.map((p) => invalidateProductCaches({ slug: p.slug, id: p.id })));
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");

  return { affected };
}

// ── Inline quick-edit (single product) ───────────────────────
//
// Used by the admin products table for click-to-edit price, toggle active,
// toggle featured. Writes PriceHistory when price changes (Czech 30-day
// fake-discount law).

const quickPatchSchema = z
  .object({
    price: z.number().positive().max(1_000_000).optional(),
    active: z.boolean().optional(),
    featured: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Chybí data",
  });

export async function updateProductQuick(
  id: string,
  patch: { price?: number; active?: boolean; featured?: boolean },
): Promise<{ ok: true; product: { id: string; price: number; active: boolean; featured: boolean } }> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  if (!id || typeof id !== "string") throw new Error("Neplatné ID");
  const parsed = quickPatchSchema.parse(patch);

  const db = await getDb();
  const current = await db.product.findUnique({
    where: { id },
    select: { id: true, slug: true, price: true, active: true, featured: true },
  });
  if (!current) throw new Error("Produkt nenalezen");

  // Log old price to history BEFORE updating (30-day lowest-price rule)
  if (parsed.price !== undefined && parsed.price !== current.price) {
    await db.priceHistory.create({
      data: { productId: id, price: current.price },
    });
  }

  const updated = await db.product.update({
    where: { id },
    data: parsed,
    select: { id: true, price: true, active: true, featured: true },
  });

  revalidateTag("products", "max");
  revalidateTag("admin-products", "max");
  revalidateTag(`product-${current.slug}`, "max");
  await invalidateProductCaches({ slug: current.slug, id });
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");

  return { ok: true, product: updated };
}

// ── Inline quick-edit (measurements) ───────────────────────
//
// Used by the coverage dashboard to patch measurement fields + fitNote
// without loading the full edit form.

const measurementFieldSchema = z
  .number()
  .positive()
  .max(500)
  .optional()
  .nullable();

const measurementsPatchSchema = z.object({
  chest: measurementFieldSchema,
  waist: measurementFieldSchema,
  hips: measurementFieldSchema,
  length: measurementFieldSchema,
  sleeve: measurementFieldSchema,
  inseam: measurementFieldSchema,
  shoulders: measurementFieldSchema,
  fitNote: z.string().max(120).nullable().optional(),
});

const MEASUREMENT_KEYS = ["chest", "waist", "hips", "length", "sleeve", "inseam", "shoulders"] as const;

export async function updateProductMeasurementsQuick(
  id: string,
  patch: z.infer<typeof measurementsPatchSchema>,
): Promise<{
  ok: true;
  product: { id: string; measurements: string; fitNote: string | null };
}> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  if (!id || typeof id !== "string") throw new Error("Neplatné ID");
  const parsed = measurementsPatchSchema.parse(patch);

  const db = await getDb();
  const current = await db.product.findUnique({
    where: { id },
    select: { id: true, slug: true, measurements: true },
  });
  if (!current) throw new Error("Produkt nenalezen");

  // Merge with existing measurements — any key explicitly set to null is removed.
  let existing: Record<string, unknown> = {};
  try {
    const raw = JSON.parse(current.measurements);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) existing = raw;
  } catch {
    existing = {};
  }

  for (const key of MEASUREMENT_KEYS) {
    if (key in parsed) {
      const v = parsed[key];
      if (v === null || v === undefined) delete existing[key];
      else existing[key] = v;
    }
  }

  // Clean: keep only valid measurement keys with numeric values
  const clean: Record<string, number> = {};
  for (const key of MEASUREMENT_KEYS) {
    const v = existing[key];
    if (typeof v === "number" && isFinite(v) && v > 0) clean[key] = v;
  }

  const data: { measurements: string; fitNote?: string | null } = {
    measurements: JSON.stringify(clean),
  };
  if ("fitNote" in parsed) {
    const trimmed = parsed.fitNote?.trim();
    data.fitNote = trimmed ? trimmed.slice(0, 120) : null;
  }

  const updated = await db.product.update({
    where: { id },
    data,
    select: { id: true, measurements: true, fitNote: true },
  });

  revalidateTag("products", "max");
  revalidateTag("admin-products", "max");
  revalidateTag(`product-${current.slug}`, "max");
  await invalidateProductCaches({ slug: current.slug, id });
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/coverage");
  revalidatePath("/products");
  revalidatePath(`/products/${current.slug}`);

  return { ok: true, product: updated };
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");

  const db = await getDb();

  // Capture slug before we delete so we can invalidate the Redis product-by-slug key.
  const existing = await db.product.findUnique({
    where: { id },
    select: { slug: true },
  });

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

  revalidateTag("products", "max");
  revalidateTag("admin-products", "max");
  await invalidateProductCaches({ slug: existing?.slug, id });
  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/");
}

/**
 * Internal alt-text backfill — no auth check. Used both by the public
 * server action below and by the post-create `after()` hook (where the
 * auth/request context may already be torn down).
 */
async function backfillAltTextInternal(
  id: string,
  options: { force?: boolean } = {},
): Promise<{
  ok: boolean;
  generated: number;
  skipped: number;
  failed: number;
  reason?: string;
  images?: { url: string; alt: string; caption?: string }[];
}> {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, generated: 0, skipped: 0, failed: 0, reason: "missing_gemini_key" };
  }

  const { generateAltText } = await import("@/lib/ai/gemini-alt-text");
  const { parseProductImages } = await import("@/lib/images");

  const db = await getDb();
  const product = await db.product.findUnique({
    where: { id },
    include: { category: { select: { name: true } } },
  });
  if (!product) return { ok: false, generated: 0, skipped: 0, failed: 0, reason: "not_found" };

  const images = parseProductImages(product.images);
  let sizes: string[] = [];
  try { sizes = JSON.parse(product.sizes); } catch { /* */ }

  let generated = 0, skipped = 0, failed = 0;
  const next = await Promise.all(
    images.map(async (img) => {
      if (!options.force && img.alt && img.alt.length > 0) {
        skipped++;
        return img;
      }
      const out = await generateAltText({
        imageUrl: img.url,
        productName: product.name,
        brand: product.brand,
        condition: product.condition,
        sizes,
        categoryName: product.category.name,
      });
      if (!out) {
        failed++;
        return img;
      }
      generated++;
      return { url: img.url, alt: out.altText, caption: out.caption };
    }),
  );

  if (generated > 0) {
    await db.product.update({
      where: { id },
      data: { images: JSON.stringify(next) },
    });
    await invalidateProductCaches({ slug: product.slug, id });
    revalidatePath(`/products/${product.slug}`);
    revalidatePath("/admin/products");
  }

  return { ok: true, generated, skipped, failed, images: next };
}

/**
 * Public server action: generate Czech alt-text + caption via Gemini Flash
 * for product images that are missing it. Auth-gated + rate-limited.
 * Pass { force: true } to overwrite existing alt-text.
 */
export async function generateProductAltText(
  id: string,
  options: { force?: boolean } = {},
): Promise<{
  ok: boolean;
  generated: number;
  skipped: number;
  failed: number;
  reason?: string;
  images?: { url: string; alt: string; caption?: string }[];
}> {
  await requireAdmin();
  const rl = await rateLimitAdmin();
  if (!rl.success) throw new Error("Příliš mnoho požadavků. Zkuste to za chvíli.");
  return backfillAltTextInternal(id, options);
}
