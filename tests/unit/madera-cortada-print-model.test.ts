import { describe, expect, it } from "vitest";
import {
  buildMaderaCortadaPrintModel,
  buildMaderaCortadaVoucherLines,
} from "@/lib/madera-cortada-print-model";

const detalleRoble = {
  orden: 1,
  descripcion: "Tabla de roble selecto",
  cantidad: 4,
  unidad: "pzs",
  espesor: 2,
  ancho: 8,
  largo: 10,
  precio_unitario: 3.5,
  subtotal: 14,
};

function ventaConDetalle(overrides: Record<string, unknown> = {}) {
  return {
    id: "venta-madera-cortada-1",
    tipo_corte: "tabla",
    total_pt: 26.6667,
    precio_por_pt: 3.5,
    cantidad_piezas: 4,
    precio_unitario_comercial: 3.5,
    total: 14,
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
  it("imprime las 4 piezas a S/ 3.50 y conserva el total guardado de S/ 14.00", () => {
    const model = buildMaderaCortadaPrintModel(ventaConDetalle(), "factura");

    expect(model.hasDetailedLines).toBe(true);
    expect(model.totalSoles).toBe(14);
    expect(model.items).toHaveLength(1);
    expect(model.items[0]?.desc).toContain("Tabla de roble selecto");
    expect(model.items[0]?.desc).toContain(`2\" × 8\" × 10'`);
    expect(model.items[0]?.qty).toMatch(/4\s*pzs/i);
    expect(model.items[0]?.unitario).toContain("3.50");
    expect(model.items[0]?.total).toContain("14.00");
    expect(JSON.stringify(model)).not.toContain("93.33");
  });

  it("agrega un ajuste visible sin sustituir el total manual confirmado", () => {
    const model = buildMaderaCortadaPrintModel(
      ventaConDetalle({
        total: 14,
        precio_unitario_comercial: 4,
        lineas_comprobante: [
          {
            ...detalleRoble,
            precio_unitario: 4,
            subtotal: 16,
          },
        ],
      }),
      "boleta",
    );

    const adjustment = model.items.find((item) => /ajuste|descuento/i.test(item.desc));

    expect(model.totalSoles).toBe(14);
    expect(adjustment).toBeDefined();
    expect(importeNumerico(adjustment?.total)).toBe(-2);
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
  it("convierte el detalle registrado al formato persistido sin perder sus datos", () => {
    const lines = buildMaderaCortadaVoucherLines([
      {
        descripcion: "Tabla de roble selecto",
        cantidad: 4,
        espesor: 2,
        ancho: 8,
        largo: 10,
        precioUnitarioComercial: 3.5,
        subtotalComercial: 14,
        subtotalPT: 26.6667,
        inventario_producto_id: null,
      },
    ]);

    expect(lines).toEqual([
      {
        orden: 0,
        descripcion: "Tabla de roble selecto",
        cantidad: 4,
        unidad: "pzs",
        espesor: 2,
        ancho: 8,
        largo: 10,
        precio_unitario: 3.5,
        subtotal: 14,
      },
    ]);
  });

  it("agrupa líneas idénticas y suma cantidad e importe", () => {
    const model = buildMaderaCortadaPrintModel(
      ventaConDetalle({
        lineas_comprobante: [
          { ...detalleRoble, orden: 1, cantidad: 2, subtotal: 7 },
          { ...detalleRoble, orden: 2, cantidad: 2, subtotal: 7 },
        ],
      }),
      "boleta",
    );

    expect(model.items).toHaveLength(1);
    expect(model.items[0]?.qty).toMatch(/4\s*pzs/i);
    expect(model.items[0]?.unitario).toContain("3.50");
    expect(model.items[0]?.total).toContain("14.00");
  });

  it.each([
    ["descripción", { descripcion: "Tabla de roble premium" }],
    ["medidas", { ancho: 10 }],
    ["precio", { precio_unitario: 4, subtotal: 16 }],
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
