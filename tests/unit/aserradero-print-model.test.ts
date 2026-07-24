import { describe, expect, it } from "vitest";
import {
  buildAserraderoPrintModel,
  calculateAserraderoAdjustment,
  calculateAserraderoCutSubtotal,
} from "@/lib/aserradero-print-model";

const blocks = [
  { tipo: "bloque_cubicaje", cantidad: 1, espesor: 11, ancho: 5, largo: 14, ptUnitarioComercial: 64, ptTotalComercial: 64 },
  { tipo: "bloque_cubicaje", cantidad: 1, espesor: 8, ancho: 4, largo: 14, ptUnitarioComercial: 37, ptTotalComercial: 37 },
  { tipo: "bloque_cubicaje", cantidad: 1, espesor: 12, ancho: 5, largo: 9, ptUnitarioComercial: 45, ptTotalComercial: 45 },
];

describe("buildAserraderoPrintModel", () => {
  it("calcula 146 PT sin margen a S/0.50 y S/0.60", () => {
    expect(calculateAserraderoCutSubtotal(146, 0.5)).toBe(73);
    expect(calculateAserraderoCutSubtotal(146, 0.6)).toBe(87.6);
    expect(calculateAserraderoAdjustment(80, 87.6)).toBe(-7.6);
  });

  it("mantiene PT comercial, tarifa y precio cobrado guardados", () => {
    const model = buildAserraderoPrintModel({
      service: {
        id: "aserradero-1",
        fecha: "2026-07-23",
        correlativo: "ASR-001",
        pies_cubicos: 12.5,
        costo_cubicaje: 73,
        precio_cobrado: 73,
        metodo_pago: "yape",
        modalidad_pago: "contado",
        lineas_json: [
          ...blocks,
          {
            tipo: "resumen_aserradero",
            schemaVersion: 1,
            precioPorPT: 0.5,
            totalPTComercial: 146,
            tipoComprobante: "boleta",
          },
        ],
      },
      customer: { nombre: "Cliente Prueba", documento: "12345678" },
      tipoComprobante: "factura",
    });

    expect(model.totals.totalPTComercial).toBe(146);
    expect(model.totals.tarifaPorPT).toBe(0.5);
    expect(model.totals.subtotalCorte).toBe(73);
    expect(model.totals.totalCobrado).toBe(73);
    expect(model.totals.ajusteAlTotal).toBe(0);
    expect(model.identity.tipoComprobante).toBe("boleta");
    expect(model.payment.metodo).toBe("yape");
  });

  it("conserva el total manual como autoritativo y calcula el ajuste", () => {
    const model = buildAserraderoPrintModel({
      service: {
        id: "aserradero-2",
        fecha: "2026-07-23",
        costo_cubicaje: 87.6,
        precio_cobrado: 80,
        lineas_json: [
          ...blocks,
          {
            tipo: "resumen_aserradero",
            schemaVersion: 1,
            precioPorPT: 0.6,
            totalPTComercial: 146,
            tipoComprobante: "boleta",
          },
        ],
      },
      tipoComprobante: "boleta",
    });

    expect(model.totals.subtotalCorte).toBe(87.6);
    expect(model.totals.totalCobrado).toBe(80);
    expect(model.totals.ajusteAlTotal).toBe(-7.6);
  });

  it("no inventa tarifa, PT ni dimensiones cuando el JSON histórico es inválido", () => {
    const model = buildAserraderoPrintModel({
      service: {
        id: "historico-1",
        fecha: "2025-01-10",
        pies_cubicos: 9,
        costo_cubicaje: 45,
        precio_cobrado: 60,
        lineas_json: "{json-invalido",
      },
      tipoComprobante: "boleta",
    });

    expect(model.blocks).toEqual([]);
    expect(model.totals.totalPTComercial).toBeNull();
    expect(model.totals.tarifaPorPT).toBeNull();
    expect(model.totals.totalCobrado).toBe(60);
    expect(model.historical.modoFallback).toBe(true);
    expect(model.historical.piesCubicosRegistrados).toBe(9);
  });

  it("preserva cantidades históricas mayores que uno por bloque", () => {
    const model = buildAserraderoPrintModel({
      service: {
        id: "historico-2",
        fecha: "2025-01-10",
        costo_cubicaje: 96,
        precio_cobrado: 96,
        lineas_json: [
          {
            tipo: "bloque_cubicaje",
            cantidad: 3,
            espesor: 11,
            ancho: 5,
            largo: 14,
            ptUnitarioComercial: 64,
            ptTotalComercial: 192,
          },
        ],
      },
      tipoComprobante: "boleta",
    });

    expect(model.blocks[0]?.cantidad).toBe(3);
    expect(model.blocks[0]?.ptTotalComercial).toBe(192);
    expect(model.totals.totalBloques).toBe(3);
  });

  it.each([1, 20, 40, 80])("normaliza todos los bloques sin truncar (%i)", (count) => {
    const manyBlocks = Array.from({ length: count }, (_, index) => ({
      tipo: "bloque_cubicaje",
      cantidad: 1,
      espesor: 11,
      ancho: 5,
      largo: 14,
      ptUnitarioComercial: 64,
      ptTotalComercial: 64,
      id: `block-${index}`,
    }));
    const model = buildAserraderoPrintModel({
      service: {
        id: `many-${count}`,
        fecha: "2026-07-23",
        costo_cubicaje: count * 32,
        precio_cobrado: count * 32,
        lineas_json: [
          ...manyBlocks,
          {
            tipo: "resumen_aserradero",
            schemaVersion: 1,
            precioPorPT: 0.5,
            totalPTComercial: count * 64,
            tipoComprobante: "boleta",
          },
        ],
      },
      tipoComprobante: "boleta",
    });

    expect(model.blocks).toHaveLength(count);
    expect(model.totals.totalBloques).toBe(count);
    expect(model.totals.totalPTComercial).toBe(count * 64);
  });
});
