import type { Metadata } from "next";
import { OrderLookupForm } from "./order-lookup-form";

export const metadata: Metadata = {
  title: "Sledování objednávky",
  description: "Zadejte číslo objednávky a email pro zobrazení stavu vaší objednávky.",
};

export default function OrderLookupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
          Sledování objednávky
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Zadejte číslo objednávky a email, na který jste objednávali.
        </p>
      </div>

      <OrderLookupForm />

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Číslo objednávky najdete v potvrzovacím emailu, který jsme vám
        odeslali po vytvoření objednávky.
      </p>
    </div>
  );
}
