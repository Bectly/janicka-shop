"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createCategory, updateCategory } from "./actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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
        <Input
          type="text"
          id="name"
          name="name"
          required
          defaultValue={category?.name ?? ""}
          className="mt-1"
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
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={category?.description ?? ""}
          className="mt-1"
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
        <Input
          type="text"
          id="image"
          name="image"
          defaultValue={category?.image ?? ""}
          className="mt-1"
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
        <Input
          type="number"
          id="sortOrder"
          name="sortOrder"
          defaultValue={category?.sortOrder ?? 0}
          className="mt-1 w-32"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Nižší číslo = kategorie se zobrazí dříve.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Ukládám..."
            : isEditing
              ? "Uložit změny"
              : "Vytvořit kategorii"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/categories")}
        >
          Zrušit
        </Button>
      </div>
    </form>
  );
}
