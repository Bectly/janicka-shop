import { describe, it, expect } from "vitest";
import path from "node:path";
import { parseOdsFile } from "../../scripts/import-opatex";

const FIXTURE_DIR = path.join(__dirname, "../../docs/suppliers/opatex");

describe("OPATEX .ods parser", () => {
  it("parses a monthly pricelist (leden 2025) with header totals + 137 catalog rows", async () => {
    const file = path.join(
      FIXTURE_DIR,
      "OBJEDNÁVKOVÝ FORMULÁŘ OPATEX 2025 - leden.ods",
    );
    const parsed = await parseOdsFile(file);

    expect(parsed.totalKg).toBe(20);
    expect(parsed.totalPriceWithVat).toBe(4416.5);
    expect(parsed.rows.length).toBeGreaterThan(100);

    const row1714 = parsed.rows.find((r) => r.code === "1714");
    expect(row1714).toBeDefined();
    expect(row1714!.name).toMatch(/Trička krátký rukáv/);
    expect(row1714!.pricePerKg).toBe(85);
    expect(row1714!.kg).toBe(0); // pricelist forms ship empty
  });

  it("parses the Janička bundle with 20kg total / 5324 Kč with VAT and ≥3 ordered lines", async () => {
    const file = path.join(FIXTURE_DIR, "OBJEDNÁVKA OPATEX - Janička.ods");
    const parsed = await parseOdsFile(file);

    expect(parsed.totalKg).toBe(20);
    expect(parsed.totalPriceWithVat).toBe(5324);

    const ordered = parsed.rows.filter((r) => r.kg > 0);
    expect(ordered.length).toBeGreaterThanOrEqual(3);

    const row944 = parsed.rows.find((r) => r.code === "944");
    expect(row944).toBeDefined();
    expect(row944!.kg).toBe(5);
    expect(row944!.pricePerKg).toBe(285);
    expect(row944!.total).toBe(1425);

    const orderedTotal = ordered.reduce((sum, r) => sum + r.total, 0);
    expect(orderedTotal).toBe(parsed.totalPriceWithoutVat); // line totals sum to "Cena" (without VAT)
    expect(parsed.totalPriceWithoutVat).toBe(4400);
  });

  it("returns the same shape on repeated parses (pure function — no hidden state)", async () => {
    const file = path.join(
      FIXTURE_DIR,
      "OBJEDNÁVKOVÝ FORMULÁŘ OPATEX 2025 - duben.ods",
    );
    const a = await parseOdsFile(file);
    const b = await parseOdsFile(file);
    expect(a.totalKg).toBe(b.totalKg);
    expect(a.rows.length).toBe(b.rows.length);
    expect(a.rows[0]).toEqual(b.rows[0]);
  });
});
