import { Truck, Sparkles, RotateCcw, Star, Diamond, Shield, type LucideIcon } from "lucide-react";
import Link from "next/link";

const VINTED_WINDOW_FROM = new Date("2026-04-28T00:00:00+02:00");
const VINTED_WINDOW_UNTIL = new Date("2026-05-02T00:00:00+02:00"); // May 1 inclusive

function isVintedWindow(): boolean {
  const now = new Date();
  return now >= VINTED_WINDOW_FROM && now < VINTED_WINDOW_UNTIL;
}

const messages: { icon: LucideIcon; text: string }[] = [
  { icon: Truck,      text: "Doprava zdarma od 1 500 Kč" },
  { icon: Sparkles,   text: "Každý kousek je unikát — second hand & vintage" },
  { icon: RotateCcw,  text: "14 dní na vrácení bez udání důvodu" },
  { icon: Star,       text: "Prémiová kvalita, ověřený stav" },
];

function MessageItem({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

function MarqueeTrack() {
  return (
    <>
      {messages.map((msg, i) => (
        <span key={i} className="inline-flex items-center">
          <MessageItem icon={msg.icon} text={msg.text} />
          <Diamond className="mx-5 size-1.5 shrink-0 fill-white/30 text-white/30" aria-hidden="true" />
        </span>
      ))}
    </>
  );
}

export function AnnouncementBar() {
  const vintedWindow = isVintedWindow();

  if (vintedWindow) {
    return (
      <Link
        href="/soukromi"
        className="group relative block overflow-hidden bg-gradient-to-r from-charcoal-dark via-charcoal to-charcoal-dark text-white transition-colors hover:from-brand-dark hover:via-charcoal-dark hover:to-brand-dark"
        aria-label="Tvoje fotky jsou tvoje — přečti si víc"
      >
        <div className="announcement-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="flex min-h-10 items-center justify-center gap-2.5 px-4 sm:min-h-11">
          <Shield className="size-3.5 shrink-0 text-brand-light" aria-hidden="true" />
          <p className="text-xs font-medium tracking-wide sm:text-sm">
            <span className="font-semibold sm:hidden">Tvoje fotky jsou tvoje. Vždy.</span>
            <span className="hidden font-semibold text-brand-light sm:inline">Zatímco Vinted školí AI na tvých fotkách</span>
            <span className="text-white/60 mx-2 hidden sm:inline">—</span>
            <span className="hidden sm:inline">u&nbsp;nás jsou tvoje fotky tvoje. Vždy.</span>
          </p>
          <span className="hidden text-[11px] font-semibold tracking-wider text-brand-light/70 uppercase transition-colors group-hover:text-brand-light sm:block">
            Přečti si víc →
          </span>
        </div>
      </Link>
    );
  }

  return (
    <div className="announcement-bar relative overflow-hidden bg-gradient-to-r from-brand via-brand-dark to-brand text-white">
      <div className="announcement-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />

      <svg className="ann-blossom pointer-events-none absolute -left-3 top-1/2 size-10 -translate-y-1/2 text-white/10" viewBox="0 0 200 200" fill="currentColor" aria-hidden="true">
        <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(0 100 100)" />
        <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(72 100 100)" />
        <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(144 100 100)" />
        <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(216 100 100)" />
        <ellipse cx="100" cy="82" rx="10" ry="20" transform="rotate(288 100 100)" />
        <circle cx="100" cy="100" r="5" />
      </svg>
      <svg className="ann-blossom pointer-events-none absolute -right-3 top-1/2 size-8 -translate-y-1/2 text-white/10" viewBox="0 0 200 200" fill="currentColor" aria-hidden="true">
        <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(15 100 100)" />
        <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(87 100 100)" />
        <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(159 100 100)" />
        <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(231 100 100)" />
        <ellipse cx="100" cy="84" rx="8" ry="16" transform="rotate(303 100 100)" />
        <circle cx="100" cy="100" r="4" />
      </svg>

      <div className="flex min-h-10 items-center sm:min-h-11">
        <div
          className="announcement-marquee flex min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap lg:justify-center lg:[animation:none]"
          aria-live="polite"
        >
          <span className="inline-flex items-center px-6 text-xs font-medium tracking-wide sm:text-sm">
            <MarqueeTrack />
          </span>
          <span className="inline-flex items-center px-6 text-xs font-medium tracking-wide sm:text-sm lg:hidden" aria-hidden="true">
            <MarqueeTrack />
          </span>
        </div>
      </div>
    </div>
  );
}
