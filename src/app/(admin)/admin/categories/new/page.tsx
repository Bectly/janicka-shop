import type { Metadata } from "next";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = {
  title: "Nová kategorie",
};

export default function NewCategoryPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Nová kategorie
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Vytvořte novou kategorii produktů.
      </p>

      <div className="mt-6 max-w-xl">
        <CategoryForm />
      </div>
    </>
  );
}
