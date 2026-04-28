"use client";

import { QRCodeSVG } from "qrcode.react";
import { CONDITION_LABELS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";

export type LabelItem = {
  id: string;
  name: string;
  size: string | null;
  condition: string;
  price: number;
  qrUrl: string;
};

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

export function ThermalLabel({ item }: { item: LabelItem }) {
  const skuShort = item.id.slice(0, 8).toUpperCase();
  const cond = CONDITION_LABELS[item.condition] ?? item.condition;
  return (
    <div className="thermal-label flex h-[30mm] w-[50mm] items-stretch gap-[1.5mm] overflow-hidden border border-black/40 bg-white p-[1.5mm] text-black">
      <div className="flex shrink-0 flex-col items-center justify-center">
        <QRCodeSVG value={item.qrUrl} size={72} level="M" includeMargin={false} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between text-[8pt] leading-tight">
        <div className="font-semibold leading-tight">{truncate(item.name, 20)}</div>
        <div className="text-[7pt]">
          {item.size ? `${item.size}` : "—"}
          {" · "}
          <span className="whitespace-nowrap">{cond}</span>
        </div>
        <div className="flex items-end justify-between gap-1">
          <span className="font-mono text-[6.5pt]">{skuShort}</span>
          <span className="font-bold text-[10pt] tabular-nums">
            {formatPrice(item.price)}
          </span>
        </div>
      </div>
    </div>
  );
}
