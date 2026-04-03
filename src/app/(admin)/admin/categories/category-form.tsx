"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory } from "./actions";

interface CategoryFormProps {
  category?: {
    id: string;
    name: string;
    description: string | null;
    image: string | null;
    sortOrder: number;
  };
}

export function CategoryForm({ category }: CategoryFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const isEditing = !!category;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (isEditing) {
          await updateCategory(category.id, formData);
        } else {
          await createCategory(formData);
        }
        router.push("/admin/categories");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Něco se pokazilo");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-foreground"
        >
          Název *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          defaultValue={category?.name ?? ""}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="např. Šaty"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-foreground"
        >
          Popis
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={category?.description ?? ""}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Krátký popis kategorie (volitelné)"
        />
      </div>

      <div>
        <label
          htmlFor="image"
          className="block text-sm font-medium text-foreground"
        >
          URL obrázku
        </label>
        <input
          type="text"
          id="image"
          name="image"
          defaultValue={category?.image ?? ""}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="https://... (volitelné)"
        />
      </div>

      <div>
        <label
          htmlFor="sortOrder"
          className="block text-sm font-medium text-foreground"
        >
          Pořadí řazení
        </label>
        <input
          type="number"
          id="sortOrder"
          name="sortOrder"
          defaultValue={category?.sortOrder ?? 0}
          className="mt-1 w-32 rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Nižší číslo = kategorie se zobrazí dříve.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending
            ? "Ukládám..."
            : isEditing
              ? "Uložit změny"
              : "Vytvořit kategorii"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/categories")}
          className="rounded-lg border px-6 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}
