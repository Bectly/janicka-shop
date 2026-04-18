"use client";

import Link from "next/link";
import { useTransition, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteCategory } from "./actions";

interface CategoryRowProps {
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    sortOrder: number;
    productCount: number;
  };
}

export function CategoryRow({ category }: CategoryRowProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (
      !confirm(
        `Opravdu chcete smazat kategorii "${category.name}"?`,
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await deleteCategory(category.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba při mazání");
      }
    });
  }

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="px-4 py-3 text-muted-foreground">
          {category.sortOrder}
        </td>
        <td className="px-4 py-3">
          <div>
            <span className="font-medium text-foreground">
              {category.name}
            </span>
            {category.description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {category.description}
              </p>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
          {category.slug}
        </td>
        <td className="px-4 py-3 text-right text-muted-foreground">
          {category.productCount}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/admin/categories/${category.id}/edit`}
              className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
              title="Upravit"
            >
              <Pencil className="size-4" />
            </Link>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              title="Smazat"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={5} className="px-4 py-2">
            <p className="text-sm text-destructive">{error}</p>
          </td>
        </tr>
      )}
    </>
  );
}
