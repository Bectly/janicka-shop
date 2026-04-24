import { Truck, Sparkles, RotateCcw, Star, Diamond, type LucideIcon } from "lucide-react";

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
  return (
    <div data-hide-on-lightbox className="announcement-bar relative overflow-hidden bg-gradient-to-r from-brand via-brand-dark to-brand text-white">
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

      <div className="flex min-h-10 items-center overflow-hidden sm:min-h-11">
        <div
          className="announcement-marquee flex shrink-0 items-center whitespace-nowrap text-xs font-medium tracking-wide sm:text-sm"
          aria-live="polite"
        >
          <MarqueeTrack />
          <MarqueeTrack />
          <MarqueeTrack />
          <MarqueeTrack />
        </div>
      </div>
    </div>
  );
}
