import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generateSpayd,
  orderNumberToVariableSymbol,
  generateOrderQrPayment,
} from "./qr-platba";

describe("generateSpayd — SPAYD string generation (ČBA standard)", () => {
  it("produces a SPAYD v1.0 string with required ACC, AM, CC fields", () => {
    const out = generateSpayd({
      iban: "CZ6508000000192000145399",
      amount: 1234.5,
      variableSymbol: "2604240001",
      message: "Objednavka JN-260424-ABCD",
    });
    expect(out).toMatch(/^SPD\*1\.0\*/);
    expect(out).toContain("ACC:CZ6508000000192000145399");
    expect(out).toContain("AM:1234.50");
    expect(out).toContain("CC:CZK");
    expect(out).toContain("X-VS:2604240001");
    expect(out).toContain("MSG:");
  });

  it("formats amount to exactly two decimals", () => {
    expect(generateSpayd({ iban: "CZ6508000000192000145399", amount: 10, variableSymbol: "1" }))
      .toContain("AM:10.00");
    expect(generateSpayd({ iban: "CZ6508000000192000145399", amount: 1299, variableSymbol: "1" }))
      .toContain("AM:1299.00");
    expect(generateSpayd({ iban: "CZ6508000000192000145399", amount: 50.5, variableSymbol: "1" }))
      .toContain("AM:50.50");
  });

  it("includes receiver name when provided (upstream lib uppercases)", () => {
    const out = generateSpayd({
      iban: "CZ6508000000192000145399",
      amount: 100,
      variableSymbol: "42",
      receiverName: "Janicka",
    });
    // The spayd npm package uppercases the RN value per the ČBA spec (ASCII only).
    expect(out).toMatch(/RN:JANICKA/);
  });

  it("includes MSG field when a message is provided", () => {
    const out = generateSpayd({
      iban: "CZ6508000000192000145399",
      amount: 100,
      variableSymbol: "42",
      message: "Objednavka JN-260403",
    });
    expect(out).toContain("MSG:");
    expect(out).toMatch(/MSG:OBJEDNAVKA JN-260403/);
  });
});

describe("orderNumberToVariableSymbol — deterministic hash", () => {
  it("returns exactly 10 digits for a canonical order number", () => {
    const vs = orderNumberToVariableSymbol("JN-260403-A1B2C3D4");
    expect(vs).toMatch(/^\d{10}$/);
  });

  it("starts with the 6-digit date part", () => {
    expect(orderNumberToVariableSymbol("JN-260403-ABCD1234")).toMatch(/^260403\d{4}$/);
    expect(orderNumberToVariableSymbol("JN-251231-XYZ99999")).toMatch(/^251231\d{4}$/);
  });

  it("is deterministic — same input yields same output", () => {
    const a = orderNumberToVariableSymbol("JN-260403-A1B2C3D4");
    const b = orderNumberToVariableSymbol("JN-260403-A1B2C3D4");
    expect(a).toBe(b);
  });

  it("produces different VS for different random parts (same date)", () => {
    const a = orderNumberToVariableSymbol("JN-260403-A1B2C3D4");
    const b = orderNumberToVariableSymbol("JN-260403-FFFFFFFF");
    expect(a).not.toBe(b);
  });

  it("handles malformed order numbers without throwing", () => {
    expect(() => orderNumberToVariableSymbol("INVALID")).not.toThrow();
    expect(() => orderNumberToVariableSymbol("")).not.toThrow();
    expect(() => orderNumberToVariableSymbol("JN-")).not.toThrow();
  });

  it("pads hash to 4 digits when numerically small", () => {
    const vs = orderNumberToVariableSymbol("JN-260403-A");
    expect(vs).toHaveLength(10);
  });
});

describe("generateOrderQrPayment — env-guarded integration wrapper", () => {
  const originalIban = process.env.SHOP_IBAN;
  const originalName = process.env.SHOP_NAME;

  beforeEach(() => {
    delete process.env.SHOP_IBAN;
    delete process.env.SHOP_NAME;
  });

  afterEach(() => {
    if (originalIban !== undefined) process.env.SHOP_IBAN = originalIban;
    if (originalName !== undefined) process.env.SHOP_NAME = originalName;
  });

  it("returns null when SHOP_IBAN is not configured", async () => {
    const result = await generateOrderQrPayment("JN-260403-A1B2C3D4", 1000);
    expect(result).toBeNull();
  });

  it("returns spaydString + qrDataUrl when SHOP_IBAN is set", async () => {
    process.env.SHOP_IBAN = "CZ6508000000192000145399";
    process.env.SHOP_NAME = "Janicka Shop";
    const result = await generateOrderQrPayment("JN-260403-A1B2C3D4", 1299);
    expect(result).not.toBeNull();
    expect(result!.spaydString).toContain("ACC:CZ6508000000192000145399");
    expect(result!.spaydString).toContain("AM:1299.00");
    expect(result!.spaydString).toMatch(/RN:JANICKA SHOP/);
    expect(result!.qrDataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
