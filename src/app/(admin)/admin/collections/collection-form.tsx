"use client";

import { useActionState, useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { X, Search, Package } from "lucide-react";
import Image from "next/image";
import {
  createCollection,
  updateCollection,
  type CollectionFormState,
} from "./actions";

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string;
  brand: string | null;
}

interface CollectionFormProps {
  collection?: {
    id: string;
    title: string;
    description: string;
    slug: string;
    image: string | null;
    productIds: string; // JSON
    featured: boolean;
    sortOrder: number;
    active: boolean;
    startDate: Date | null;
    endDate: Date | null;
  };
  allProducts: Product[];
}

function getFirstImageUrl(images: string): string | null {
  try {
    const parsed = JSON.parse(images);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      if (typeof first === "string") return first;
      if (first && typeof first === "object" && "url" in first) return first.url;
    }
  } catch { /* */ }
  return null;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(price);
}

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().split("T")[0];
}

export function CollectionForm({ collection, allProducts }: CollectionFormProps) {
  const isEdit = !!collection;
  const initialProductIds: string[] = collection
    ? (() => { try { return JSON.parse(collection.productIds); } catch { return []; } })()
    : [];

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(initialProductIds);
  const [searchQuery, setSearchQuery] = useState("");

  const boundAction = isEdit
    ? updateCollection.bind(null, collection!.id)
    : createCollection;

  const [state, dispatch, isPending] = useActionState<CollectionFormState, FormData>(
    boundAction,
    { error: null, fieldErrors: {} },
  );

  const toggleProduct = useCallback((productId: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  }, []);

  const removeProduct = useCallback((productId: string) => {
    setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
  }, []);

  // Filter products by search
  const filteredProducts = searchQuery.trim()
    ? allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.brand && p.brand.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : allProducts;

  const selectedProducts = allProducts.filter((p) => selectedProductIds.includes(p.id));

  return (
    <form action={dispatch} className="space-y-6">
      <input type="hidden" name="productIds" value={JSON.stringify(selectedProductIds)} />

      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title">Název kolekce</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={collection?.title}
          placeholder="Jarní šaty pod 500 Kč"
        />
        {state.fieldErrors.title && (
          <p className="text-xs text-destructive">{state.fieldErrors.title}</p>
        )}
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <Label htmlFor="slug">Slug (URL)</Label>
        <Input
          id="slug"
          name="slug"
          defaultValue={collection?.slug}
          placeholder="jarni-saty-pod-500"
        />
        <p className="text-xs text-muted-foreground">
          Nechte prázdné pro automatické vygenerování z názvu.
        </p>
        {state.fieldErrors.slug && (
          <p className="text-xs text-destructive">{state.fieldErrors.slug}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Popis</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={collection?.description}
          placeholder="Krátký popis kolekce pro zákazníky..."
        />
      </div>

      {/* Image URL */}
      <div className="space-y-2">
        <Label htmlFor="image">Obrázek (URL)</Label>
        <Input
          id="image"
          name="image"
          defaultValue={collection?.image ?? ""}
          placeholder="https://..."
        />
        <p className="text-xs text-muted-foreground">
          Volitelný obrázek kolekce pro homepage a listing.
        </p>
      </div>

      {/* Settings row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Pořadí</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min="0"
            max="9999"
            defaultValue={collection?.sortOrder ?? 0}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">Od</Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={toDateInputValue(collection?.startDate ?? null)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">Do</Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={toDateInputValue(collection?.endDate ?? null)}
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          {/* Hidden fallback: disabled when checkbox is checked so only one value is submitted */}
          <input
            type="hidden"
            name="featured"
            value={String(false)}
            defaultValue={String(false)}
            // Disable on initial render if defaultChecked is true — avoids double submission
            ref={(el) => { if (el) el.disabled = collection?.featured ?? false; }}
          />
          <input
            type="checkbox"
            name="featured"
            value="true"
            defaultChecked={collection?.featured ?? false}
            className="size-4 rounded accent-primary"
            onChange={(e) => {
              const hidden = e.target.previousElementSibling as HTMLInputElement;
              hidden.disabled = e.target.checked;
            }}
          />
          <span className="text-sm font-medium">Na homepage</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="hidden"
            name="active"
            value="false"
            defaultValue="false"
            // Disable on initial render if defaultChecked is true
            ref={(el) => { if (el) el.disabled = collection?.active ?? true; }}
          />
          <input
            type="checkbox"
            name="active"
            value="true"
            defaultChecked={collection?.active ?? true}
            className="size-4 rounded accent-primary"
            onChange={(e) => {
              const hidden = e.target.previousElementSibling as HTMLInputElement;
              hidden.disabled = e.target.checked;
            }}
          />
          <span className="text-sm font-medium">Aktivní</span>
        </label>
      </div>

      {/* Selected products */}
      <div className="space-y-3">
        <Label>
          Vybrané produkty ({selectedProductIds.length})
        </Label>
        {selectedProducts.length > 0 ? (
          <div className="divide-y rounded-lg border">
            {selectedProducts.map((product) => {
              const imgUrl = getFirstImageUrl(product.images);
              return (
                <div key={product.id} className="flex items-center gap-3 p-2.5">
                  <div className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={product.name}
                        width={40}
                        height={40}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                        <Package className="size-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.brand && `${product.brand} · `}
                      {formatPrice(product.price)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProduct(product.id)}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Zatím žádné produkty. Vyberte z katalogu níže.
          </p>
        )}
      </div>

      {/* Product search + picker */}
      <div className="space-y-3">
        <Label>Přidat produkty</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Hledat produkt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
          {filteredProducts.length === 0 ? (
            <p className="p-3 text-center text-sm text-muted-foreground">
              Žádné produkty nenalezeny.
            </p>
          ) : (
            filteredProducts.slice(0, 50).map((product) => {
              const imgUrl = getFirstImageUrl(product.images);
              const isSelected = selectedProductIds.includes(product.id);
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => toggleProduct(product.id)}
                  className={`flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-muted/50 ${
                    isSelected ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="size-8 shrink-0 overflow-hidden rounded bg-muted">
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt={product.name}
                        width={32}
                        height={32}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                        <Package className="size-3" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.brand && `${product.brand} · `}
                      {formatPrice(product.price)}
                    </p>
                  </div>
                  <div
                    className={`flex size-5 shrink-0 items-center justify-center rounded border-2 ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    }`}
                  >
                    {isSelected && (
                      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Ukládám..."
            : isEdit
              ? "Uložit změny"
              : "Vytvořit kolekci"}
        </Button>
      </div>
    </form>
  );
}
