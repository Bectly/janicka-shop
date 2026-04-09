export const revalidate = 60;
import type { Metadata } from "next";
import { WishlistContent } from "./wishlist-content";

export const metadata: Metadata = {
  title: "Oblíbené",
  description: "Vaše oblíbené kousky na jednom místě.",
};

export default function WishlistPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-foreground">
          Oblíbené
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vaše oblíbené kousky na jednom místě
        </p>
      </div>
      <WishlistContent />
    </div>
  );
}
