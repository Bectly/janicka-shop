"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { CONDITION_LABELS, CONDITION_COLORS } from "@/lib/constants";
import { ImageIcon, Eye, EyeOff, Star, StarOff, Trash2, X, Check, AlertCircle, CircleDollarSign, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteProductButton } from "@/components/admin/delete-product-button";
import { DuplicateProductButton } from "@/components/admin/duplicate-product-button";
import { BulkPriceDialog } from "@/components/admin/bulk-price-dialog";
import {
  InlinePriceEdit,
  ProductQuickToggles,
} from "@/components/admin/product-quick-edit";
import { getImageUrls } from "@/lib/images";
import { bulkUpdateProducts } from "@/app/(admin)/admin/products/actions";

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  price: number;
  images: string;
  brand: string | null;
  condition: string;
  active: boolean;
  sold: boolean;
  featured: boolean;
  category: { name: string };
  watcherCount?: number;
}

interface BulkProductTableProps {
  products: ProductRow[];
  query?: string;
}

export function BulkProductTable({ products, query }: BulkProductTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);

  const selectedProductsLite = products
    .filter((p) => selected.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, price: p.price }));

  const allOnPage = products.map((p) => p.id);
  const allSelected = allOnPage.length > 0 && allOnPage.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allOnPage));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function runBulk(action: string, label: string) {
    const ids = Array.from(selected);
    if (action === "delete" && !confirm(`Opravdu smazat ${ids.length} produktů?`)) return;

    startTransition(async () => {
      try {
        const result = await bulkUpdateProducts(ids, action);
        setMessage({ text: `${label}: ${result.affected} produktů`, error: false });
        setSelected(new Set());
        setTimeout(() => setMessage(null), 3000);
      } catch (e: unknown) {
        setMessage({ text: `Chyba: ${e instanceof Error ? e.message : "neznámá"}`, error: true });
        setTimeout(() => setMessage(null), 5000);
      }
    });
  }

  return (
    <>
      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-4 rounded border-muted-foreground/30 accent-primary"
                    aria-label="Vybrat vše"
                  />
                </th>
                <th className="w-14 px-3 py-3 text-left font-medium text-muted-foreground">
                  <span className="sr-only">Foto</span>
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Produkt
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                  Kategorie
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground sm:table-cell">
                  Značka
                </th>
                <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                  Stav
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Cena
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Akce
                </th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="size-8 opacity-40" />
                      <span className="text-sm">
                        {query ? `Žádné produkty pro „${query}"` : "Žádné produkty"}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const images = getImageUrls(product.images);
                  const isSelected = selected.has(product.id);
                  return (
                    <tr
                      key={product.id}
                      className={`border-b last:border-0 transition-colors duration-150 ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}
                    >
                      <td className="w-10 px-3 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(product.id)}
                          className="size-4 rounded border-muted-foreground/30 accent-primary"
                          aria-label={`Vybrat ${product.name}`}
                        />
                      </td>
                      <td className="w-14 px-3 py-3">
                        {images[0] ? (
                          <Image
                            src={images[0]}
                            alt=""
                            width={40}
                            height={40}
                            unoptimized
                            className="size-10 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                            <ImageIcon className="size-4 text-muted-foreground" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-foreground">
                              {product.name}
                            </p>
                            {(product.watcherCount ?? 0) > 0 && (
                              <Link
                                href={`/admin/products/${product.id}/edit#price-watchers`}
                                title={`${product.watcherCount} ${product.watcherCount === 1 ? "zákazník sleduje" : "zákazníků sleduje"} cenu`}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                              >
                                <Bell className="size-3" />
                                Sledují {product.watcherCount}
                              </Link>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {product.sku}
                            {product.featured && (
                              <Star className="ml-1 inline size-3 fill-amber-400 text-amber-400" />
                            )}
                          </p>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {product.category.name}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                        {product.brand ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_COLORS[product.condition] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {CONDITION_LABELS[product.condition] ?? product.condition}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        <InlinePriceEdit id={product.id} price={product.price} />
                      </td>
                      <td className="px-4 py-3">
                        {product.sold ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            Prodáno
                          </span>
                        ) : (
                          <ProductQuickToggles
                            id={product.id}
                            active={product.active}
                            featured={product.featured}
                            sold={product.sold}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Upravit
                          </Link>
                          <DuplicateProductButton
                            productId={product.id}
                            productName={product.name}
                          />
                          <DeleteProductButton
                            productId={product.id}
                            productName={product.name}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk action bar — fixed at bottom when items selected */}
      {someSelected && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground">
                {selected.size}
              </span>
              <span className="text-sm text-muted-foreground">
                {selected.size === 1 ? "produkt vybrán" : selected.size >= 2 && selected.size <= 4 ? "produkty vybrány" : "produktů vybráno"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => runBulk("activate", "Aktivováno")}
                disabled={isPending}
              >
                <Eye className="size-3.5" />
                <span className="hidden sm:inline">Aktivovat</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runBulk("hide", "Skryto")}
                disabled={isPending}
              >
                <EyeOff className="size-3.5" />
                <span className="hidden sm:inline">Skrýt</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runBulk("feature", "Přidáno do featured")}
                disabled={isPending}
              >
                <Star className="size-3.5" />
                <span className="hidden sm:inline">Featured</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => runBulk("unfeature", "Odebráno z featured")}
                disabled={isPending}
              >
                <StarOff className="size-3.5" />
                <span className="hidden sm:inline">Unfeatured</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPriceDialogOpen(true)}
                disabled={isPending}
              >
                <CircleDollarSign className="size-3.5" />
                <span className="hidden sm:inline">Změnit cenu</span>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => runBulk("delete", "Smazáno")}
                disabled={isPending}
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Smazat</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
                disabled={isPending}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk price change dialog */}
      <BulkPriceDialog
        open={priceDialogOpen}
        onOpenChange={setPriceDialogOpen}
        selectedProducts={selectedProductsLite}
        onSuccess={(affected) => {
          setMessage({ text: `Ceny změněny: ${affected} produktů`, error: false });
          setSelected(new Set());
          setTimeout(() => setMessage(null), 3000);
        }}
        onError={(msg) => {
          setMessage({ text: `Chyba: ${msg}`, error: true });
          setTimeout(() => setMessage(null), 5000);
        }}
      />

      {/* Success/error message toast */}
      {message && (
        <div className={`fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm shadow-lg ${message.error ? "bg-destructive text-destructive-foreground" : "bg-foreground text-background"}`}>
          <div className="flex items-center gap-2">
            {message.error ? <AlertCircle className="size-4" /> : <Check className="size-4" />}
            {message.text}
          </div>
        </div>
      )}
    </>
  );
}
