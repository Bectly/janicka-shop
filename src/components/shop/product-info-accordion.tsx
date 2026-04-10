import { Truck, RotateCcw, ShieldCheck, ChevronDown } from "lucide-react";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_PRICES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";

function AccordionItem({
  icon,
  title,
  children,
  defaultOpen,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group border-b border-border last:border-b-0"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="flex cursor-pointer items-center gap-3 py-4 text-sm font-medium text-foreground select-none [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 pl-6 text-sm leading-relaxed text-muted-foreground sm:pl-8">
        {children}
      </div>
    </details>
  );
}

export function ProductInfoAccordion() {
  return (
    <div className="mt-6 rounded-xl border border-border">
      <AccordionItem
        icon={<Truck className="size-4" />}
        title="Doprava"
        defaultOpen
      >
        <ul className="space-y-1.5">
          <li>Zásilkovna — výdejní místo: {formatPrice(SHIPPING_PRICES.packeta_pickup)}</li>
          <li>Zásilkovna — na adresu: {formatPrice(SHIPPING_PRICES.packeta_home)}</li>
          <li>Česká pošta: {formatPrice(SHIPPING_PRICES.czech_post)}</li>
        </ul>
        <p className="mt-2 font-medium text-sage-dark">
          Doprava zdarma od {formatPrice(FREE_SHIPPING_THRESHOLD)}
        </p>
        <p className="mt-1.5">
          Objednávky odesíláme do 1–2 pracovních dnů.
        </p>
      </AccordionItem>

      <AccordionItem
        icon={<RotateCcw className="size-4" />}
        title="Vrácení a reklamace"
      >
        <p>
          Máte <strong>14 dní</strong> na vrácení zboží bez udání důvodu od
          převzetí zásilky. Zboží musí být nepoškozené, neprané a v&nbsp;původním
          stavu.
        </p>
        <p className="mt-1.5">
          Záruční doba na použité zboží je <strong>12 měsíců</strong>.
          Reklamace vyřídíme do 30 dnů.
        </p>
      </AccordionItem>

      <AccordionItem
        icon={<ShieldCheck className="size-4" />}
        title="Záruka kvality"
      >
        <p>
          Každý kousek pečlivě kontrolujeme a fotografujeme. Stav je vždy
          přesně popsán — žádná nepříjemná překvapení.
        </p>
        <p className="mt-1.5">
          Na Vintedu nevíš, co kupuješ. <strong>U nás ano.</strong>
        </p>
      </AccordionItem>
    </div>
  );
}
