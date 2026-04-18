"use client";

import { useState, useTransition } from "react";
import { deleteProduct } from "@/app/(admin)/admin/products/actions";
import { Trash2 } from "lucide-react";

interface DeleteProductButtonProps {
  productId: string;
  productName: string;
}

export function DeleteProductButton({
  productId,
  productName,
}: DeleteProductButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteProduct(productId);
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs font-medium text-destructive hover:underline"
        >
          {isPending ? "Mažu..." : "Smazat"}
        </button>
        <span className="text-xs text-muted-foreground">|</span>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-muted-foreground hover:underline"
        >
          Zrušit
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-muted-foreground transition-all duration-150 hover:text-destructive active:scale-90"
      aria-label={`Smazat ${productName}`}
      title={`Smazat ${productName}`}
    >
      <Trash2 className="size-4" />
    </button>
  );
}
