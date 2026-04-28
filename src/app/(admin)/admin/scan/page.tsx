import Link from "next/link";
import { ArrowLeft, ScanLine } from "lucide-react";
import type { Metadata } from "next";

import { QrScannerClient } from "./scanner-client";

export const metadata: Metadata = { title: "Skenovat štítek" };

export default function ScanPage() {
  return (
    <>
      <Link
        href="/admin/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zpět na přehled
      </Link>
      <div className="flex items-center gap-2">
        <ScanLine className="size-6 text-primary" aria-hidden />
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Skenovat štítek
        </h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Namiř telefon na QR štítek a otevři detail produktu.
      </p>

      <div className="mt-6 max-w-md">
        <QrScannerClient />
      </div>
    </>
  );
}
