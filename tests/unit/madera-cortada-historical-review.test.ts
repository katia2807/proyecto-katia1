import { describe, expect, it } from "vitest";
import {
  maderaCortadaHistoricalStatusLabels,
  reviewMaderaCortadaHistoricalSale,
} from "@/lib/madera-cortada-historical-review";
import type { MaderaCortadaVoucherLine } from "@/lib/madera-cortada-print-model";

const detalleCorrecto: MaderaCortadaVoucherLine = {
  orden: 0,
  descripcion: "Tabla de roble",
  cantidad: 4,
  unidad: "pzs",
  espesor: 1,
  ancho: 8,
  largo: 10,
  precio_unitario: 23.333333,
  subtotal: 93.33,
};

function ventaHistorica(overrides: Record<string, unknown> = {}) {
  return {
    total_pt: 26.6667,
    precio_por_pt: 3.5,
    cantidad_piezas: 4,
    total: 93.33,
    lineas_comprobante: [detalleCorrecto],
    ...overrides,
  };
}

describe("reviewMaderaCortadaHistoricalSale", () => {
  it("marca como falta de información una venta sin líneas y no inventa detalle", () => {
    const review = reviewMaderaCortadaHistoricalSale(ventaHistorica({
      total: 14,
      lineas_comprobante: null,
    }));

    expect(review.status).toBe("falta_informacion");
    expect(review.issues).toEqual([
      expect.objectContaining({ code: "sin_detalle" }),
    ]);
    expect(review.storedLines).toEqual([]);
    expect(review.calculatedQuantity).toBe(0);
    expect(review.calculatedTotalPt).toBe(0);
    expect(review.calculatedSubtotal).toBe(0);
    expect(review.difference).toBe(-14);
  });

  it("señala cada dato faltante de una línea incompleta", () => {
    const review = reviewMaderaCortadaHistoricalSale(ventaHistorica({
      lineas_comprobante: [{
        ...detalleCorrecto,
        descripcion: "   ",
        espesor: 0,
        ancho: 0,
        largo: 0,
      }],
    }));

    expect(review.status).toBe("falta_informacion");
    expect(review.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "descripcion_faltante", lineIndex: 0 }),
      expect.objectContaining({ code: "medidas_faltantes", lineIndex: 0 }),
    ]));
    expect(review.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "precio_linea_incorrecto" }),
      expect.objectContaining({ code: "subtotal_linea_incorrecto" }),
    ]));
    expect(review.calculatedSubtotal).toBe(0);
  });

  it("pide reemplazar una descripción genérica por un detalle útil para el cliente", () => {
    const review = reviewMaderaCortadaHistoricalSale(ventaHistorica({
      lineas_comprobante: [{
        ...detalleCorrecto,
        descripcion: "Tabla de madera cortada",
      }],
    }));

    expect(review.status).toBe("falta_informacion");
    expect(review.issues).toEqual([
      expect.objectContaining({ code: "descripcion_generica", lineIndex: 0 }),
    ]);
  });

  it("conserva las líneas incompletas para que Katia pueda verlas y corregirlas", () => {
    const review = reviewMaderaCortadaHistoricalSale(ventaHistorica({
      lineas_comprobante: [
        detalleCorrecto,
        {
          ...detalleCorrecto,
          orden: 1,
          descripcion: "Listón pendiente",
          cantidad: 0,
          subtotal: 0,
        },
      ],
    }));

    expect(review.storedLines).toHaveLength(2);
    expect(review.storedLines[1]).toEqual(expect.objectContaining({
      descripcion: "Listón pendiente",
      cantidad: 0,
    }));
    expect(review.status).toBe("falta_informacion");
    expect(review.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "cantidad_faltante", lineIndex: 1 }),
    ]));
  });

  it("detecta el importe antiguo de S/14 frente al cálculo correcto de S/93.33", () => {
    const review = reviewMaderaCortadaHistoricalSale(ventaHistorica({
      total: 14,
      lineas_comprobante: [{
        ...detalleCorrecto,
        precio_unitario: 3.5,
        subtotal: 14,
      }],
    }));

    expect(review.status).toBe("importe_no_coincide");
    expect(review.calculatedTotalPt).toBeCloseTo(26.666666, 5);
    expect(review.calculatedQuantity).toBe(4);
    expect(review.calculatedSubtotal).toBe(93.33);
    expect(review.storedTotal).toBe(14);
    expect(review.difference).toBe(79.33);
    expect(review.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "precio_linea_incorrecto", lineIndex: 0 }),
      expect.objectContaining({ code: "subtotal_linea_incorrecto", lineIndex: 0 }),
      expect.objectContaining({ code: "total_con_ajuste" }),
    ]));
  });

  it("marca como correcta una venta cuyo detalle, PT e importe coinciden", () => {
    const review = reviewMaderaCortadaHistoricalSale(ventaHistorica());

    expect(review.status).toBe("correcta");
    expect(review.issues).toEqual([]);
    expect(review.calculatedTotalPt).toBeCloseTo(26.666666, 5);
    expect(review.calculatedQuantity).toBe(4);
    expect(review.calculatedSubtotal).toBe(93.33);
    expect(review.difference).toBe(0);
  });

  it("detecta un PT guardado distinto aunque el total monetario coincida", () => {
    const review = reviewMaderaCortadaHistoricalSale(ventaHistorica({
      total_pt: 24,
    }));

    expect(review.status).toBe("importe_no_coincide");
    expect(review.storedTotalPt).toBe(24);
    expect(review.calculatedTotalPt).toBeCloseTo(26.666666, 5);
    expect(review.calculatedSubtotal).toBe(93.33);
    expect(review.difference).toBe(0);
    expect(review.issues).toEqual([
      expect.objectContaining({ code: "pt_no_coincide" }),
    ]);
  });

  it("separa un ajuste comercial de un error en el detalle", () => {
    const review = reviewMaderaCortadaHistoricalSale(ventaHistorica({
      total: 90,
    }));

    expect(review.status).toBe("ajuste_interno");
    expect(review.calculatedSubtotal).toBe(93.33);
    expect(review.storedTotal).toBe(90);
    expect(review.difference).toBe(3.33);
    expect(review.issues).toEqual([
      expect.objectContaining({ code: "total_con_ajuste" }),
    ]);
    expect(review.issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "precio_linea_incorrecto" }),
      expect.objectContaining({ code: "subtotal_linea_incorrecto" }),
      expect.objectContaining({ code: "pt_no_coincide" }),
    ]));
  });

  it("mantiene etiquetas comprensibles para los cuatro estados", () => {
    expect(maderaCortadaHistoricalStatusLabels).toEqual({
      correcta: "Correcta",
      falta_informacion: "Falta información",
      importe_no_coincide: "Importe no coincide",
      ajuste_interno: "Ajuste interno",
    });
  });
});
