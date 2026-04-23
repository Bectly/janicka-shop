"use client";

import { useEffect, useState } from "react";
import { Lightbulb, Ruler } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

type Diagram = "top" | "shoulders" | "bottom" | "sleeve";

function MeasurementDiagram({ type }: { type: Diagram }) {
  const stroke = "currentColor";
  if (type === "top") {
    return (
      <svg
        viewBox="0 0 120 120"
        className="h-16 w-16 shrink-0 text-foreground/80 sm:h-24 sm:w-24"
        aria-hidden="true"
      >
        {/* T-shirt silhouette */}
        <path
          d="M30 25 L45 15 L75 15 L90 25 L108 40 L98 55 L90 48 L90 105 L30 105 L30 48 L22 55 L12 40 Z"
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Chest / waist line */}
        <line
          x1="30"
          y1="62"
          x2="90"
          y2="62"
          stroke="var(--color-primary, #d4788f)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        {/* Arrow ends */}
        <polyline
          points="34,58 30,62 34,66"
          fill="none"
          stroke="var(--color-primary, #d4788f)"
          strokeWidth="2"
        />
        <polyline
          points="86,58 90,62 86,66"
          fill="none"
          stroke="var(--color-primary, #d4788f)"
          strokeWidth="2"
        />
      </svg>
    );
  }
  if (type === "shoulders") {
    return (
      <svg
        viewBox="0 0 120 120"
        className="h-16 w-16 shrink-0 text-foreground/80 sm:h-24 sm:w-24"
        aria-hidden="true"
      >
        {/* T-shirt silhouette */}
        <path
          d="M30 25 L45 15 L75 15 L90 25 L108 40 L98 55 L90 48 L90 105 L30 105 L30 48 L22 55 L12 40 Z"
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Shoulder-to-shoulder measurement line */}
        <line
          x1="30"
          y1="31"
          x2="90"
          y2="31"
          stroke="var(--color-primary, #d4788f)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <polyline
          points="34,27 30,31 34,35"
          fill="none"
          stroke="var(--color-primary, #d4788f)"
          strokeWidth="2"
        />
        <polyline
          points="86,27 90,31 86,35"
          fill="none"
          stroke="var(--color-primary, #d4788f)"
          strokeWidth="2"
        />
      </svg>
    );
  }
  if (type === "bottom") {
    return (
      <svg
        viewBox="0 0 120 120"
        className="h-16 w-16 shrink-0 text-foreground/80 sm:h-24 sm:w-24"
        aria-hidden="true"
      >
        {/* Pants silhouette */}
        <path
          d="M35 15 L85 15 L88 60 L78 110 L62 110 L60 65 L58 110 L42 110 L32 60 Z"
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Inseam line */}
        <line
          x1="60"
          y1="65"
          x2="70"
          y2="108"
          stroke="var(--color-primary, #d4788f)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        <polyline
          points="57,67 60,65 63,68"
          fill="none"
          stroke="var(--color-primary, #d4788f)"
          strokeWidth="2"
        />
        <polyline
          points="68,104 70,108 73,105"
          fill="none"
          stroke="var(--color-primary, #d4788f)"
          strokeWidth="2"
        />
      </svg>
    );
  }
  // sleeve
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-16 w-16 shrink-0 text-foreground/80 sm:h-24 sm:w-24"
      aria-hidden="true"
    >
      {/* Long-sleeve garment */}
      <path
        d="M30 30 L45 20 L75 20 L90 30 L115 50 L105 62 L90 55 L90 105 L30 105 L30 55 L15 62 L5 50 Z"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Sleeve measurement from shoulder seam to cuff */}
      <line
        x1="88"
        y1="32"
        x2="110"
        y2="55"
        stroke="var(--color-primary, #d4788f)"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      <polyline
        points="86,35 88,32 91,34"
        fill="none"
        stroke="var(--color-primary, #d4788f)"
        strokeWidth="2"
      />
      <polyline
        points="107,52 110,55 108,58"
        fill="none"
        stroke="var(--color-primary, #d4788f)"
        strokeWidth="2"
      />
    </svg>
  );
}

function GuideBody() {
  const items: {
    key: string;
    title: string;
    desc: string;
    diagram: Diagram;
  }[] = [
    {
      key: "chest",
      title: "Prsa / pas (topy, šaty)",
      desc:
        "Kus polož na plocho, napni látku. Měř přímou čarou od jednoho kraje k druhému ve výšce 3 cm pod průramkem (podpaží). Výsledek × 2 = celkový obvod.",
      diagram: "top",
    },
    {
      key: "shoulders",
      title: "Šířka ramen",
      desc:
        "U topů a bund: od jednoho ramenního švu ke druhému — tam, kde se rukáv napojuje na tělo. Měř přímou čarou přes zadní díl, nikoli přes krk.",
      diagram: "shoulders",
    },
    {
      key: "waist",
      title: "Šířka v pase (kalhoty, sukně)",
      desc:
        "Zapnutý kus polož na plocho s vyrovnaným pasem. Měř od kraje ke kraji po horní hraně pásku. Výsledek × 2 = celkový obvod pasu.",
      diagram: "bottom",
    },
    {
      key: "hips",
      title: "Šířka v bocích",
      desc:
        "U kalhot/sukní měř v nejširší části (typicky 18–22 cm pod pasem). U topů a šatů měř přes nejširší místo v oblasti boků. Vždy přes plocho, × 2.",
      diagram: "bottom",
    },
    {
      key: "length",
      title: "Délka (celková)",
      desc:
        "U topů: od nejvyššího bodu ramenního švu (u krku) rovně dolů k lemu. U kalhot/sukní: od horní hrany pásku k lemu po vnější straně nohavice.",
      diagram: "top",
    },
    {
      key: "sleeve",
      title: "Délka rukávu",
      desc:
        "Od ramenního švu (tam, kde se rukáv spojuje s tělem) podél horní hrany rukávu až ke konci manžety. Měř rovnou čarou.",
      diagram: "sleeve",
    },
    {
      key: "inseam",
      title: "Vnitřní délka nohavice (krok)",
      desc:
        "Od švu v rozkroku rovně dolů po vnitřní straně nohavice až k lemu. Kalhoty polož na plocho s vyrovnaným zadním švem.",
      diagram: "bottom",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-primary/10 bg-primary/[0.035] p-3 text-xs text-muted-foreground">
        <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary/60" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">Tip od Janičky</p>
          <p className="mt-1">
            Nejspolehlivější způsob je porovnat rozměry s kusem, který ti už sedí.
            Polož ho na plocho a změř stejným způsobem — rozdíl v cm ti hned
            napoví, jestli ti kus sedne.
          </p>
        </div>
      </div>

      <ul className="space-y-4">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-3 rounded-lg border border-border bg-background p-3"
          >
            <MeasurementDiagram type={item.diagram} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {item.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {item.desc}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Všechny míry u nás jsou v cm, na ploše (nenatažené, bez zdvojení).
        Odchylka ± 1–2 cm je u second hand normální.
      </p>
    </div>
  );
}

const triggerClass =
  "inline-flex items-center gap-1 rounded-sm text-[11px] font-medium text-primary transition-colors duration-150 hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1";

export function MeasurementGuide() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // SSR / pre-hydration: render desktop dialog as default (safe, smaller bundle impact)
  if (isDesktop === null || isDesktop) {
    return (
      <Dialog>
        <DialogTrigger className={triggerClass}>
          <Ruler className="size-3.5" aria-hidden="true" />
          Jak měřit?
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Jak měříme rozměry kusu?</DialogTitle>
            <DialogDescription>
              Každý kus měříme na ploše v centimetrech. Tady je, jak přesně.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <GuideBody />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer>
      <DrawerTrigger className={triggerClass}>
        <Ruler className="size-3.5" aria-hidden="true" />
        Jak měřit?
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Jak měříme rozměry kusu?</DrawerTitle>
          <DrawerDescription>
            Každý kus měříme na ploše v centimetrech. Tady je, jak přesně.
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <GuideBody />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
