import Image from "next/image";
import { Truck, RotateCcw, ShieldCheck, Package } from "lucide-react";

const tiles = [
  {
    icon: Truck,
    label: "Doručení",
    detail: "do 24 hodin",
  },
  {
    icon: RotateCcw,
    label: "Vrácení",
    detail: "do 30 dní",
  },
  {
    icon: ShieldCheck,
    label: "Bezpečná platba",
    detail: "Comgate / QR",
  },
  {
    icon: Package,
    label: "Balené",
    detail: "s láskou",
  },
];

export function TrustStrip() {
  return (
    <section
      aria-label="Co máte u nás"
      className="bg-blush-light"
    >
      <div className="mx-auto max-w-7xl px-4 py-section sm:px-6 lg:px-8">
        <div className="mb-stack flex flex-col items-center text-center">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.25em] text-brand uppercase">
            05 / Co máte u&nbsp;nás
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-stack-sm lg:grid-cols-4">
          {tiles.map(({ icon: Icon, label, detail }) => (
            <li
              key={label}
              className="flex flex-col items-center gap-stack-xs rounded-card bg-card px-stack-sm py-stack ring-1 ring-inset ring-border/50 text-center"
            >
              <Image
                src="/decor/sparkle.svg"
                alt=""
                aria-hidden="true"
                width={12}
                height={12}
                className="size-3 text-brand/50"
              />
              <Icon
                className="size-7 text-brand"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <p className="font-heading text-base text-foreground sm:text-lg">
                {label}
              </p>
              <p className="text-xs text-charcoal-light sm:text-sm">{detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
