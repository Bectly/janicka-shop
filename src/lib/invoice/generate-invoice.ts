import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { INTER_REGULAR_BASE64, INTER_BOLD_BASE64 } from "./font-data";

export interface InvoiceData {
  // Invoice
  invoiceNumber: string;
  issuedAt: Date;
  taxableEventDate: Date; // DUZP — datum uskutečnění zdanitelného plnění

  // Seller
  sellerName: string;
  sellerStreet: string;
  sellerCity: string;
  sellerZip: string;
  sellerIco: string;
  sellerDic: string; // empty = not VAT payer
  sellerEmail: string;
  sellerPhone: string;

  // Buyer
  buyerName: string;
  buyerStreet: string;
  buyerCity: string;
  buyerZip: string;
  buyerCountry: string;
  buyerEmail: string;

  // Order reference
  orderNumber: string;
  paymentMethod: string;

  // Items
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    size?: string | null;
  }[];

  // Totals
  subtotal: number;
  shipping: number;
  shippingLabel: string;
  total: number;
}

// Fonts are embedded as base64 in font-data.ts — works on Vercel serverless

function formatCzDate(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  
          timeZone: "Europe/Prague",
        }).format(date);
}

function formatCzPrice(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function generateInvoicePdf(data: InvoiceData): Uint8Array {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Register Inter fonts (embedded base64 data — works on Vercel serverless)
  doc.addFileToVFS("Inter-Regular.ttf", INTER_REGULAR_BASE64);
  doc.addFont("Inter-Regular.ttf", "Inter", "normal");
  doc.addFileToVFS("Inter-Bold.ttf", INTER_BOLD_BASE64);
  doc.addFont("Inter-Bold.ttf", "Inter", "bold");

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;

  doc.setFont("Inter", "normal");

  // ── Header ──
  doc.setFont("Inter", "bold");
  doc.setFontSize(22);
  doc.setTextColor(26, 26, 26);
  doc.text("FAKTURA", marginLeft, 25);

  doc.setFont("Inter", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Číslo: ${data.invoiceNumber}`, marginLeft, 33);

  // Shop name in top-right
  doc.setFont("Inter", "bold");
  doc.setFontSize(16);
  doc.setTextColor(26, 26, 26);
  doc.text(data.sellerName, pageWidth - marginRight, 25, { align: "right" });

  // ── Dates line ──
  let y = 42;
  doc.setFont("Inter", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);

  const datesLine = [
    `Datum vystavení: ${formatCzDate(data.issuedAt)}`,
    `DUZP: ${formatCzDate(data.taxableEventDate)}`,
  ].join("     ");
  doc.text(datesLine, marginLeft, y);
  y += 4;
  doc.text(`Objednávka: ${data.orderNumber}`, marginLeft, y);

  // ── Divider ──
  y += 6;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += 8;

  // ── Seller + Buyer side by side ──
  const colWidth = contentWidth / 2 - 5;

  // Seller
  doc.setFont("Inter", "bold");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("DODAVATEL", marginLeft, y);

  doc.setFont("Inter", "bold");
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 26);
  doc.text(data.sellerName, marginLeft, y + 6);

  doc.setFont("Inter", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let sellerY = y + 11;
  doc.text(data.sellerStreet, marginLeft, sellerY);
  sellerY += 4;
  doc.text(`${data.sellerZip} ${data.sellerCity}`, marginLeft, sellerY);
  sellerY += 6;

  doc.setFontSize(8);
  doc.text(`IČO: ${data.sellerIco}`, marginLeft, sellerY);
  sellerY += 4;
  if (data.sellerDic) {
    doc.text(`DIČ: ${data.sellerDic}`, marginLeft, sellerY);
    sellerY += 4;
  } else {
    doc.text("Nejsem plátce DPH", marginLeft, sellerY);
    sellerY += 4;
  }
  if (data.sellerEmail) {
    doc.text(data.sellerEmail, marginLeft, sellerY);
    sellerY += 4;
  }
  if (data.sellerPhone) {
    doc.text(data.sellerPhone, marginLeft, sellerY);
  }

  // Buyer
  const buyerX = marginLeft + colWidth + 10;
  doc.setFont("Inter", "bold");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("ODBĚRATEL", buyerX, y);

  doc.setFont("Inter", "bold");
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 26);
  doc.text(data.buyerName, buyerX, y + 6);

  doc.setFont("Inter", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  let buyerY = y + 11;
  if (data.buyerStreet) {
    doc.text(data.buyerStreet, buyerX, buyerY);
    buyerY += 4;
  }
  if (data.buyerCity || data.buyerZip) {
    doc.text(
      `${data.buyerZip} ${data.buyerCity}`.trim(),
      buyerX,
      buyerY,
    );
    buyerY += 4;
  }
  if (data.buyerCountry && data.buyerCountry !== "CZ") {
    doc.text(data.buyerCountry, buyerX, buyerY);
    buyerY += 4;
  }
  doc.setFontSize(8);
  doc.text(data.buyerEmail, buyerX, buyerY);

  // ── Items Table ──
  y = Math.max(sellerY, buyerY) + 12;

  doc.setDrawColor(220, 220, 220);
  doc.line(marginLeft, y - 4, pageWidth - marginRight, y - 4);

  const tableHead = [["Položka", "Počet", "Cena/ks", "Celkem"]];
  const tableBody = data.items.map((item) => {
    const hasVelMarker = /\(vel\.\s*[^)]+\)/i.test(item.name);
    const name = item.size && !hasVelMarker ? `${item.name} (vel. ${item.size})` : item.name;
    return [
      name,
      String(item.quantity),
      `${formatCzPrice(item.unitPrice)} Kč`,
      `${formatCzPrice(item.totalPrice)} Kč`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    theme: "plain",
    styles: {
      font: "Inter",
      fontSize: 9,
      cellPadding: { top: 3, bottom: 3, left: 2, right: 2 },
      textColor: [50, 50, 50],
      lineColor: [230, 230, 230],
      lineWidth: 0.2,
    },
    headStyles: {
      font: "Inter",
      fontStyle: "bold",
      fontSize: 8,
      textColor: [120, 120, 120],
      fillColor: [248, 248, 248],
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 18, halign: "center" },
      2: { cellWidth: 30, halign: "right" },
      3: { cellWidth: 30, halign: "right" },
    },
    margin: { left: marginLeft, right: marginRight },
  });

  // ── Totals ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jspdf-autotable adds lastAutoTable at runtime
  y = (doc as any).lastAutoTable.finalY + 6;
  const totalsX = pageWidth - marginRight;

  doc.setFont("Inter", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);

  // Subtotal
  doc.text("Mezisoučet:", totalsX - 40, y, { align: "right" });
  doc.setTextColor(50, 50, 50);
  doc.text(`${formatCzPrice(data.subtotal)} Kč`, totalsX, y, {
    align: "right",
  });

  // Shipping
  y += 5;
  doc.setTextColor(100, 100, 100);
  doc.text(`Doprava (${data.shippingLabel}):`, totalsX - 40, y, {
    align: "right",
  });
  doc.setTextColor(50, 50, 50);
  doc.text(
    data.shipping === 0
      ? "Zdarma"
      : `${formatCzPrice(data.shipping)} Kč`,
    totalsX,
    y,
    { align: "right" },
  );

  // Total line
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(totalsX - 80, y, totalsX, y);
  y += 5;

  doc.setFont("Inter", "bold");
  doc.setFontSize(12);
  doc.setTextColor(26, 26, 26);
  doc.text("Celkem k úhradě:", totalsX - 45, y, { align: "right" });
  doc.text(`${formatCzPrice(data.total)} Kč`, totalsX, y, {
    align: "right",
  });

  // ── Payment method ──
  y += 10;
  doc.setFont("Inter", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Způsob platby: ${data.paymentMethod}`, marginLeft, y);

  // ── VAT notice ──
  if (!data.sellerDic) {
    y += 5;
    doc.text(
      "Prodejce není plátcem DPH dle §6 zákona č. 235/2004 Sb.",
      marginLeft,
      y,
    );
  }

  // ── Footer ──
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.setDrawColor(230, 230, 230);
  doc.line(marginLeft, footerY - 4, pageWidth - marginRight, footerY - 4);
  doc.text(
    `${data.sellerName} · IČO: ${data.sellerIco} · ${data.sellerEmail}`,
    pageWidth / 2,
    footerY,
    { align: "center" },
  );
  doc.text(
    `Faktura ${data.invoiceNumber} · Vystaveno ${formatCzDate(data.issuedAt)}`,
    pageWidth / 2,
    footerY + 4,
    { align: "center" },
  );

  return new Uint8Array(doc.output("arraybuffer"));
}
