"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONDITION_LABELS } from "@/lib/constants";
import { Save } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface ProductData {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAt: number | null;
  sku: string;
  categoryId: string;
  brand: string | null;
  condition: string;
  sizes: string;
  colors: string;
  featured: boolean;
  active: boolean;
}

interface ProductFormProps {
  categories: Category[];
  product?: ProductData;
  action: (formData: FormData) => Promise<void>;
}

export function ProductForm({ categories, product, action }: ProductFormProps) {
  async function formAction(_prev: string | null, formData: FormData) {
    try {
      await action(formData);
      return null;
    } catch (e) {
      if (e instanceof Error && e.message !== "NEXT_REDIRECT") {
        return e.message;
      }
      throw e;
    }
  }

  const [error, dispatch, isPending] = useActionState(formAction, null);

  return (
    <form action={dispatch} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Name */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="name">Název produktu</Label>
          <Input
            id="name"
            name="name"
            defaultValue={product?.name}
            required
            placeholder="např. Letní šaty Adéla"
          />
        </div>

        {/* Description */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="description">Popis</Label>
          <Textarea
            id="description"
            name="description"
            defaultValue={product?.description}
            required
            rows={3}
            placeholder="Stručný popis produktu, stav, materiál..."
          />
        </div>

        {/* Price */}
        <div className="space-y-2">
          <Label htmlFor="price">Cena (Kč)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            min={0}
            step={1}
            defaultValue={product?.price}
            required
            placeholder="490"
          />
        </div>

        {/* Original price */}
        <div className="space-y-2">
          <Label htmlFor="compareAt">Původní cena (Kč)</Label>
          <Input
            id="compareAt"
            name="compareAt"
            type="number"
            min={0}
            step={1}
            defaultValue={product?.compareAt ?? ""}
            placeholder="1290"
          />
          <p className="text-xs text-muted-foreground">
            Retail cena pro zobrazení slevy
          </p>
        </div>

        {/* SKU */}
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            name="sku"
            defaultValue={product?.sku}
            required
            placeholder="SAT-001"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="categoryId">Kategorie</Label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={product?.categoryId}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Vyberte kategorii</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Brand */}
        <div className="space-y-2">
          <Label htmlFor="brand">Značka</Label>
          <Input
            id="brand"
            name="brand"
            defaultValue={product?.brand ?? ""}
            placeholder="Zara, H&M, Mango..."
          />
        </div>

        {/* Condition */}
        <div className="space-y-2">
          <Label htmlFor="condition">Stav zboží</Label>
          <select
            id="condition"
            name="condition"
            defaultValue={product?.condition ?? "excellent"}
            required
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Sizes */}
        <div className="space-y-2">
          <Label htmlFor="sizes">Velikost</Label>
          <Input
            id="sizes"
            name="sizes"
            defaultValue={product?.sizes}
            required
            placeholder="M"
          />
          <p className="text-xs text-muted-foreground">
            Oddělte čárkou, např. S, M, L
          </p>
        </div>

        {/* Colors */}
        <div className="space-y-2">
          <Label htmlFor="colors">Barva</Label>
          <Input
            id="colors"
            name="colors"
            defaultValue={product?.colors}
            required
            placeholder="Černá"
          />
          <p className="text-xs text-muted-foreground">
            Oddělte čárkou, např. Černá, Bílá
          </p>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product?.featured ?? false}
            className="size-4 rounded border-input"
          />
          Doporučený produkt
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="active"
            defaultChecked={product?.active ?? true}
            value="on"
            className="size-4 rounded border-input"
          />
          Aktivní (viditelný v obchodě)
        </label>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          <Save className="size-4" />
          {isPending
            ? "Ukládám..."
            : product
              ? "Uložit změny"
              : "Vytvořit produkt"}
        </Button>
      </div>
    </form>
  );
}
