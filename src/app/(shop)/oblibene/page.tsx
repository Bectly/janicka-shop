import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Heart } from "lucide-react";
import { auth } from "@/lib/auth";
import { WishlistContent } from "./wishlist-content";

export const metadata: Metadata = {
  title: "Oblíbené",
  description: "Vaše oblíbené kousky na jednom místě.",
};

export default async function WishlistPage() {
  await connection();
  const session = await auth();
  if (session?.user?.role === "customer") {
    redirect("/account/oblibene");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col items-start gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.06] px-3 py-1 text-xs font-semibold tracking-wide text-primary">
          <Heart className="size-3 fill-current" />
          Tvůj výběr
        </span>
        <h1 className="font-heading text-[1.75rem] font-bold text-foreground sm:text-3xl">
          Oblíbené kousky
        </h1>
        <p className="text-sm text-muted-foreground">
          Vaše vybrané kousky na jednom místě — vždy po ruce
        </p>
      </div>
      <WishlistContent />
    </div>
  );
}
