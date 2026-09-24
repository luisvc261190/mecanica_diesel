import { describe, expect, it } from "vitest";

import { formatCurrency, formatFileSize, formatHours, formatNumber, formatPlate } from "@/lib/format";

describe("formatCurrency", () => {
  it("formatea montos Decimal (string) es-PE en soles", () => {
    expect(formatCurrency("1250.00")).toContain("1,250.00");
    expect(formatCurrency("1250.00")).toMatch(/^S\/?/);
  });

  it("acepta números", () => {
    expect(formatCurrency(99.9)).toContain("99.90");
  });

  it("devuelve \"—\" ante valores inválidos", () => {
    expect(formatCurrency("abc")).toBe("—");
    expect(formatCurrency(Number.NaN)).toBe("—");
  });
});

describe("formatNumber", () => {
  it("formatea números y strings numéricos", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber("42")).toBe("42");
  });

  it("devuelve \"—\" ante null/undefined/NaN", () => {
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber("x")).toBe("—");
  });
});

describe("formatPlate", () => {
  it("normaliza y agrega el guion", () => {
    expect(formatPlate("abc123")).toBe("ABC-123");
    expect(formatPlate("ABC 456")).toBe("ABC-456");
  });

  it("devuelve solo letras cuando no hay dígitos", () => {
    expect(formatPlate("abc")).toBe("ABC");
  });

  it("devuelve \"—\" ante vacíos", () => {
    expect(formatPlate(null)).toBe("—");
    expect(formatPlate("")).toBe("—");
  });
});

describe("formatHours", () => {
  it("formatea horas con decimales limitados", () => {
    expect(formatHours(2.5)).toBe("2.5");
    expect(formatHours("3", 0)).toBe("3");
  });

  it("devuelve \"—\" ante vacíos", () => {
    expect(formatHours(null)).toBe("—");
  });
});

describe("formatFileSize", () => {
  it("formatea en unidades", () => {
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(0)).toBe("—");
  });
});