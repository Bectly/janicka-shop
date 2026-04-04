"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Pencil, Trash2, Star, Eye, EyeOff } from "lucide-react";
import { deleteCollection } from "./actions";

interface CollectionRowProps {
  collection: {
    id: string;
    title: string;
    slug: string;
    productCount: number;
    featured: boolean;
    active: boolean;
    sortOrder: number;
  };
}

export function CollectionRow({ collection }: CollectionRowProps) {
  const [isDeleting, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`Opravdu chcete smazat kolekci "${collection.title}"?`)) return;
    startTransition(() => {
      deleteCollection(collection.id);
    });
  };

  return (
    <tr className={`border-b last:border-0 transition-colors hover:bg-muted/30 ${isDeleting ? "opacity-50" : ""}`}>
      <td className="px-4 py-3 text-muted-foreground">{collection.sortOrder}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{collection.title}</span>
          {collection.featured && (
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
        {collection.slug}
      </td>
      <td className="px-4 py-3 text-center">
        <span className="text-sm font-medium">{collection.productCount}</span>
      </td>
      <td className="px-4 py-3 text-center">
        {collection.active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            <Eye className="size-3" />
            Aktivní
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <EyeOff className="size-3" />
            Skrytá
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/admin/collections/${collection.id}/edit`}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-4" />
          </Link>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
