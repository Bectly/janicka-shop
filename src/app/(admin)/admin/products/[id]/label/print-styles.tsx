"use client";

export function ThermalPrintStyles() {
  return (
    <style>{`
@media print {
  @page { size: 50mm 30mm; margin: 0; }
  html, body { background: white !important; }
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; inset: 0; padding: 0; margin: 0; }
  .thermal-label { border: none !important; page-break-after: always; }
  .thermal-label:last-child { page-break-after: auto; }
}
`}</style>
  );
}

export function A4PrintStyles() {
  return (
    <style>{`
@media print {
  @page { size: A4; margin: 8mm; }
  html, body { background: white !important; }
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; inset: 0; padding: 0; margin: 0; }
  .a4-grid { page-break-inside: avoid; }
}
`}</style>
  );
}
