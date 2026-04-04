import type { Metadata } from "next";
import { OrderLookupForm } from "./lookup-form";

export const metadata: Metadata = {
  title: "Sledování objednávky",
  description: "Zadejte číslo objednávky a e-mail pro zobrazení stavu vaší objednávky.",
};

export default function OrderLookupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-center font-heading text-2xl font-bold text-foreground">
        Sledování objednávky
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Zadejte číslo objednávky a e-mail, na který jste objednávali.
      </p>

      <OrderLookupForm />
    </div>
  );
}
