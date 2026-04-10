import type { Metadata } from "next";
import { Package } from "lucide-react";
import { OrderLookupForm } from "./order-lookup-form";

export const metadata: Metadata = {
  title: "Sledování objednávky",
  description: "Zadejte číslo objednávky a email pro zobrazení stavu vaší objednávky.",
};

export default function OrderLookupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      {/* Editorial header */}
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
          <Package className="size-3" />
          Vaše objednávka
        </span>
        <h1 className="font-heading text-[1.75rem] font-bold text-foreground sm:text-3xl">
          Sledování objednávky
        </h1>
        <p className="text-sm text-muted-foreground">
          Zadejte číslo objednávky a e-mail, na který jste objednávali.
        </p>
      </div>

      <OrderLookupForm />

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Číslo objednávky najdete v potvrzovacím e-mailu, který jsme vám
        odeslali po vytvoření objednávky.
      </p>
    </div>
  );
}
