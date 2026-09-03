import { describe, expect, it } from "vitest";
import {
  buildMaderaCortadaPrintModel,
  buildMaderaCortadaVoucherLines,
  getMaderaCortadaCustomerItems,
} from "@/lib/madera-cortada-print-model";
import { roundMoney } from "@/lib/utils";

const detalleRoble = {
  orden: 1,
  descripcion: "Tabla de roble selecto",
  cantidad: 4,
  unidad: "pzs",
  espesor: 1,
  ancho: 8,
  largo: 10,
  precio_unitario: 23.333333333333332,
  subtotal: 93.33,
};

function ventaConDetalle(overrides: Record<string, unknown> = {}) {
  return {
    id: "venta-madera-cortada-1",
    tipo_corte: "tabla",
    total_pt: 26.6667,
    precio_por_pt: 3.5,
    cantidad_piezas: 4,
    precio_unitario_comercial: 23.33,
    total: 93.33,
    tipo_comprobante: "boleta",
    lineas_comprobante: [detalleRoble],
    ...overrides,
  };
}

function importeNumerico(value: unknown) {
  const text = String(value);
  const sign = text.includes("-") ? -1 : 1;
  const normalized = text.replace(/[^\d.,]/g, "").replace(",", ".");
  return sign * Number(normalized);
}

describe("buildMaderaCortadaPrintModel", () => {
  it("imprime 4 tablas de 1 × 8 × 10 a S/ 23.33 y total S/ 93.33", () => {
    const model = buildMaderaCortadaPrintModel(ventaConDetalle(), "factura");

    expect(model.hasDetailedLines).toBe(true);
    expect(model.totalSoles).toBe(93.33);
    expect(model.items).toHaveLength(1);
    expect(model.items[0]?.desc).toContain("Tabla de roble selecto");
    expect(model.items[0]?.desc).toContain(`1\" × 8\" × 10'`);
    expect(model.items[0]?.qty).toMatch(/4\s*pzs/i);
    expect(model.items[0]?.unitario).toContain("23.33");
    expect(model.items[0]?.total).toContain("93.33");
  });

  it.each([
    ["descuento", 90, -3.33],
    ["ajuste", 100, 6.67],
  ])("conserva el %s internamente pero lo oculta del comprobante del cliente", (_label, total, expectedAdjustment) => {
    const model = buildMaderaCortadaPrintModel(
      ventaConDetalle({
        total,
      }),
      "boleta",
    );

    const adjustment = model.items.find((item) => /ajuste|descuento/i.test(item.desc));
    const customerItems = getMaderaCortadaCustomerItems(model.items, model.totalSoles);

    expect(model.totalSoles).toBe(total);
    expect(adjustment).toBeDefined();
    expect(adjustment?.kind).toBe("ajuste");
    expect(importeNumerico(adjustment?.total)).toBe(expectedAdjustment);
    expect(customerItems).toHaveLength(1);
    expect(customerItems.every((item) => item.kind === "producto")).toBe(true);
    expect(JSON.stringify(customerItems)).not.toMatch(/ajuste|descuento/i);
    expect(importeNumerico(customerItems[0]?.total)).toBe(total);
    expect(importeNumerico(customerItems[0]?.unitario)).toBe(roundMoney(total / 4));
  });

  it("integra en la línea visible el total corregido de una venta histórica", () => {
    const model = buildMaderaCortadaPrintModel({
      tipo_corte: "tabla",
      total_pt: 26.6667,
      precio_por_pt: 3.5,
      cantidad_piezas: 4,
      precio_unitario_comercial: 3.5,
      total: 93.33,
      lineas_comprobante: null,
    });

    const customerItems = getMaderaCortadaCustomerItems(model.items, model.totalSoles);

    expect(model.items.some((item) => item.kind === "ajuste")).toBe(true);
    expect(customerItems).toHaveLength(1);
    expect(customerItems[0]?.unitario).toContain("23.33");
    expect(customerItems[0]?.total).toContain("93.33");
  });

  it("usa un fallback histórico solo con los datos existentes", () => {
    const model = buildMaderaCortadaPrintModel(
      {
        id: "venta-historica",
        tipo_corte: "tabla",
        total_pt: 26.6667,
        precio_por_pt: 3.5,
        cantidad_piezas: null,
        precio_unitario_comercial: null,
        total: 93.33,
        tipo_comprobante: null,
        lineas_comprobante: null,
      },
      "boleta",
    );

    expect(model.hasDetailedLines).toBe(false);
    expect(model.totalSoles).toBe(93.33);
    expect(model.items).toHaveLength(1);
    expect(model.items[0]?.qty).toMatch(/26(?:[.,]6667)?\s*PT/i);
    expect(model.items[0]?.desc).not.toMatch(/roble|cedro|tornillo|caoba/i);
    expect(model.items[0]?.desc).not.toMatch(/\d+(?:[.,]\d+)?\s*[x×]\s*\d+/i);
  });

  it("da prioridad al tipo de comprobante guardado sobre el solicitado", () => {
    const model = buildMaderaCortadaPrintModel(ventaConDetalle(), "factura");

    expect(model.tipoComprobante).toBe("boleta");
  });
});

describe("buildMaderaCortadaVoucherLines", () => {
  it("recalcula en el servidor el precio con PT real antes de persistir", () => {
    const lines = buildMaderaCortadaVoucherLines([
      {
        descripcion: "Tabla de roble selecto",
        cantidad: 4,
        espesor: 1,
        ancho: 8,
        largo: 10,
        precioUnitarioComercial: 3.5,
        subtotalComercial: 14,
        subtotalPT: 26.6667,
        inventario_producto_id: null,
      },
    ], 3.5);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      orden: 0,
      descripcion: "Tabla de roble selecto",
      cantidad: 4,
      unidad: "pzs",
      espesor: 1,
      ancho: 8,
      largo: 10,
      subtotal: 93.33,
    });
    expect(lines[0]?.precio_unitario).toBeCloseTo(23.333333, 5);
  });

  it("descarta filas vacías para que no aparezcan como piezas en la boleta", () => {
    const lines = buildMaderaCortadaVoucherLines([
      {
        descripcion: "Fila incompleta",
        cantidad: 1,
        espesor: 0,
        ancho: 0,
        largo: 0,
        precioUnitarioComercial: 0,
        subtotalComercial: 0,
        subtotalPT: 0,
        inventario_producto_id: null,
      },
      {
        descripcion: "Tabla de roble selecto",
        cantidad: 4,
        espesor: 1,
        ancho: 8,
        largo: 10,
        precioUnitarioComercial: 0,
        subtotalComercial: 0,
        subtotalPT: 0,
        inventario_producto_id: null,
      },
    ], 3.5);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.descripcion).toBe("Tabla de roble selecto");
  });

  it("agrupa líneas idénticas y suma cantidad e importe", () => {
    const model = buildMaderaCortadaPrintModel(
      ventaConDetalle({
        lineas_comprobante: [
          { ...detalleRoble, orden: 1, cantidad: 2, subtotal: 46.67 },
          { ...detalleRoble, orden: 2, cantidad: 2, subtotal: 46.66 },
        ],
      }),
      "boleta",
    );

    expect(model.items).toHaveLength(1);
    expect(model.items[0]?.qty).toMatch(/4\s*pzs/i);
    expect(model.items[0]?.unitario).toContain("23.33");
    expect(model.items[0]?.total).toContain("93.33");
  });

  it.each([
    ["descripción", { descripcion: "Tabla de roble premium" }],
    ["medidas", { ancho: 10 }],
    ["precio", { precio_unitario: 24, subtotal: 96 }],
  ])("no agrupa líneas con diferente %s", (_field, difference) => {
    const model = buildMaderaCortadaPrintModel(
      ventaConDetalle({
        total: 28,
        lineas_comprobante: [
          detalleRoble,
          { ...detalleRoble, orden: 2, ...difference },
        ],
      }),
      "boleta",
    );

    expect(model.items.filter((item) => item.kind === "producto")).toHaveLength(2);
  });
});
