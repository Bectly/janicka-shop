import Link from "next/link";
import { Camera, ArrowRight } from "lucide-react";

type Props = {
  href?: string;
  className?: string;
};

export function PhotoAddCTA({
  href = "/admin/products/quick-add",
  className = "",
}: Props) {
  return (
    <Link
      href={href}
      aria-label="Jdu fotit a přidávat — rychlé přidání kousků"
      className={`group relative flex min-h-[120px] items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 p-5 text-white shadow-lg shadow-pink-500/30 transition-all duration-200 hover:scale-[1.02] hover:from-pink-400 hover:to-pink-500 hover:shadow-pink-500/40 active:scale-[0.98] sm:min-h-24 sm:p-6 ${className}`}
    >
      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
        <Camera
          className="size-7 motion-safe:animate-pulse motion-safe:[animation-duration:3s]"
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold leading-tight sm:text-xl">
          Jdu fotit a přidávat
        </p>
        <p className="mt-0.5 text-sm text-pink-100/90">
          Rychlé přidání kousků
        </p>
      </div>
      <ArrowRight
        className="hidden size-5 shrink-0 text-white/80 transition-transform group-hover:translate-x-1 sm:block"
        aria-hidden
      />
    </Link>
  );
}
