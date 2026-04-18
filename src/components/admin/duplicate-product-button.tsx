"use client";

import { useTransition } from "react";
import { duplicateProduct } from "@/app/(admin)/admin/products/actions";
import { Copy } from "lucide-react";

interface DuplicateProductButtonProps {
  productId: string;
  productName: string;
}

export function DuplicateProductButton({
  productId,
  productName,
}: DuplicateProductButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDuplicate() {
    startTransition(async () => {
      await duplicateProduct(productId);
    });
  }

  return (
    <button
      onClick={handleDuplicate}
      disabled={isPending}
      className="text-muted-foreground transition-colors duration-150 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      title={`Duplikovat ${productName}`}
    >
      <Copy className="size-4" />
    </button>
  );
}
