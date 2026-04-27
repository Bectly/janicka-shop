"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { deleteSupplier, toggleSupplierActive } from "./actions";
import {
  SupplierFormSheet,
  type SupplierFormValues,
} from "./supplier-form-sheet";

interface Props {
  supplier: SupplierFormValues & {
    active: boolean;
    bundleCount: number;
  };
}

export function SupplierRow({ supplier }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [isToggling, startToggle] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleToggle() {
    setError(null);
    startToggle(async () => {
      try {
        await toggleSupplierActive(supplier.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba při změně stavu");
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Opravdu chcete smazat dodavatele "${supplier.name}"? Tuto akci nelze vrátit.`,
      )
    ) {
      return;
    }
    setError(null);
    startDelete(async () => {
      try {
        await deleteSupplier(supplier.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chyba při mazání");
      }
    });
  }

  return (
    <>
      <tr className="border-b last:border-0 hover:bg-muted/30">
        <td className="px-4 py-3">
          <div>
            <Link
              href={`/admin/suppliers/${supplier.id}`}
              className="font-medium text-foreground hover:underline"
            >
              {supplier.name}
            </Link>
            {supplier.url && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                {supplier.url}
              </p>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
              supplier.active
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            title={supplier.active ? "Deaktivovat" : "Aktivovat"}
          >
            <span
              className={`size-1.5 rounded-full ${
                supplier.active ? "bg-emerald-500" : "bg-muted-foreground/50"
              }`}
            />
            {supplier.active ? "Aktivní" : "Neaktivní"}
          </button>
        </td>
        <td className="px-4 py-3 text-right text-muted-foreground">
          {supplier.bundleCount}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            <SupplierFormSheet supplier={supplier} trigger="icon" />
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              title="Smazat"
              aria-label="Smazat dodavatele"
            >
              <Trash2 className="size-4" />
            </button>
            <Link
              href={`/admin/suppliers/${supplier.id}`}
              className="rounded-lg p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95"
              title="Detail"
              aria-label="Otevřít detail"
            >
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={4} className="px-4 py-2">
            <p className="text-sm text-destructive">{error}</p>
          </td>
        </tr>
      )}
    </>
  );
}
