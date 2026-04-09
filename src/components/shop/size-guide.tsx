"use client";

import { Ruler } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

const TOP_SIZES = [
  { eu: "XS (34)", bust: "80–84", waist: "60–64", hips: "86–90" },
  { eu: "S (36)", bust: "84–88", waist: "64–68", hips: "90–94" },
  { eu: "M (38)", bust: "88–92", waist: "68–72", hips: "94–98" },
  { eu: "L (40)", bust: "92–96", waist: "72–76", hips: "98–102" },
  { eu: "XL (42)", bust: "96–100", waist: "76–80", hips: "102–106" },
  { eu: "XXL (44)", bust: "100–104", waist: "80–84", hips: "106–110" },
];

const BOTTOM_SIZES = [
  { eu: "XS (34)", waist: "60–64", hips: "86–90", inseam: "76" },
  { eu: "S (36)", waist: "64–68", hips: "90–94", inseam: "77" },
  { eu: "M (38)", waist: "68–72", hips: "94–98", inseam: "78" },
  { eu: "L (40)", waist: "72–76", hips: "98–102", inseam: "79" },
  { eu: "XL (42)", waist: "76–80", hips: "102–106", inseam: "80" },
  { eu: "XXL (44)", waist: "80–84", hips: "106–110", inseam: "81" },
];

function SizeTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            {headers.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-3 py-2 ${j === 0 ? "font-medium" : "text-muted-foreground"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SizeGuide() {
  return (
    <Dialog>
      <DialogTrigger className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary hover:underline">
        <Ruler className="size-4" />
        Průvodce velikostmi
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Průvodce velikostmi</DialogTitle>
          <DialogDescription>
            Všechny míry jsou v centimetrech. U second hand oblečení se rozměry
            mohou mírně lišit.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-6 overflow-y-auto">
          {/* Tops / Dresses / Jackets */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Topy, šaty, halenky, bundy
            </h3>
            <SizeTable
              headers={["Velikost", "Prsa (cm)", "Pas (cm)", "Boky (cm)"]}
              rows={TOP_SIZES.map((s) => [s.eu, s.bust, s.waist, s.hips])}
            />
          </div>

          {/* Bottoms */}
          <div>
            <h3 className="mb-2 text-sm font-semibold">Kalhoty, sukně</h3>
            <SizeTable
              headers={[
                "Velikost",
                "Pas (cm)",
                "Boky (cm)",
                "Délka nohavice (cm)",
              ]}
              rows={BOTTOM_SIZES.map((s) => [
                s.eu,
                s.waist,
                s.hips,
                s.inseam,
              ])}
            />
          </div>

          {/* How to measure */}
          <div className="rounded-lg bg-muted/50 p-4">
            <h3 className="mb-2 text-sm font-semibold">Jak se správně změřit</h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>
                <strong>Prsa</strong> — měřte v nejširším místě přes hrudník
              </li>
              <li>
                <strong>Pas</strong> — měřte v nejužším místě trupu
              </li>
              <li>
                <strong>Boky</strong> — měřte v nejširším místě přes zadek
              </li>
              <li>
                <strong>Délka nohavice</strong> — měřte od rozkroku po kotník
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
