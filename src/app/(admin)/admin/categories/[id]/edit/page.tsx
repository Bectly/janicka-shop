import { getDb } from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { CategoryForm } from "../../category-form";

export const metadata: Metadata = {
  title: "Upravit kategorii",
};

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();

  const category = await db.category.findUnique({
    where: { id },
  });

  if (!category) {
    notFound();
  }

  return (
    <>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Upravit kategorii
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Úprava kategorie &ldquo;{category.name}&rdquo;.
      </p>

      <div className="mt-6 max-w-xl">
        <CategoryForm
          category={{
            id: category.id,
            name: category.name,
            description: category.description,
            image: category.image,
            sortOrder: category.sortOrder,
          }}
        />
      </div>
    </>
  );
}
