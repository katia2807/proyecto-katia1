import { describe, expect, it } from "vitest";
import { calculateMaderaCortadaRealPtPricing } from "@/lib/madera-cortada-pricing";

describe("calculateMaderaCortadaRealPtPricing", () => {
  it("usa el PT real y redondea únicamente el subtotal monetario", () => {
    const result = calculateMaderaCortadaRealPtPricing({
      cantidad: 4,
      espesor: 1,
      ancho: 8,
      largo: 10,
      precioPorPt: 3.5,
    });

    expect(result.ptUnitarioReal).toBeCloseTo(6.666666, 5);
    expect(result.ptTotalReal).toBeCloseTo(26.666666, 5);
    expect(result.precioUnitarioComercial).toBeCloseTo(23.333333, 5);
    expect(result.subtotalComercial).toBe(93.33);
  });

  it("no produce valores inválidos con entradas vacías", () => {
    expect(calculateMaderaCortadaRealPtPricing({
      cantidad: Number.NaN,
      espesor: 0,
      ancho: 0,
      largo: 0,
      precioPorPt: 0,
    })).toEqual({
      ptUnitarioReal: 0,
      ptTotalReal: 0,
      precioUnitarioComercial: 0,
      subtotalComercial: 0,
    });
  });
});
