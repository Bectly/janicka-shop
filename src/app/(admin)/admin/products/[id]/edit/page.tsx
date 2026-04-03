import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/product-form";
import { updateProduct } from "../../actions";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: product ? `Upravit: ${product.name}` : "Produkt nenalezen" };
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({ where: { id } }),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) notFound();

  const sizes: string[] = JSON.parse(product.sizes);
  const colors: string[] = JSON.parse(product.colors);

  const productData = {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    compareAt: product.compareAt,
    sku: product.sku,
    categoryId: product.categoryId,
    brand: product.brand,
    condition: product.condition,
    sizes: sizes.join(", "),
    colors: colors.join(", "),
    featured: product.featured,
    active: product.active,
  };

  async function action(formData: FormData) {
    "use server";
    await updateProduct(id, formData);
  }

  return (
    <>
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zpět na produkty
      </Link>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Upravit produkt
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{product.name}</p>

      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <ProductForm
          categories={categories}
          product={productData}
          action={action}
        />
      </div>
    </>
  );
}
