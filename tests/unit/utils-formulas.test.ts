import { formatPen, formatDate } from "@/lib/utils";
import {
  calcularPrecioConMargen,
  computeResumenMargen,
  computeTotalesDetalle,
  parseMargenGananciaInput,
  totalPtLinea,
} from "@/lib/cotizacion-calculos";
import { buildLineasResumen } from "@/lib/cotizacion-unificada-lineas";
import { defaultCotizacionDetalleV1 } from "@/lib/cotizacion-unificada-payload";

describe("formatPen", () => {
  test("formatea soles correctamente", () => {
    expect(formatPen(1250.5)).toContain("1,250.50");
    expect(formatPen(0)).toContain("0.00");
    expect(formatPen(-100)).toContain("100.00");
  });

  test("incluye símbolo de soles", () => {
    const result = formatPen(500);
    expect(result).toContain("S/");
  });
});

describe("calculos de muebles con piezas dinamicas", () => {
  test("suma PT total de todas las piezas multiplicando cantidad por pieza", () => {
    const piezas = [
      { cantidad: 2, espesor: 2, ancho: 6, largo: 5 },
      { cantidad: 1, espesor: 1, ancho: 12, largo: 8 },
    ];

    expect(totalPtLinea(piezas)).toBe(18);
  });

  test("madera proyectada y precio total usan el PT total de todas las piezas", () => {
    const detalle = defaultCotizacionDetalleV1();
    detalle.rubros.muebles = true;
    detalle.costoManoObra = 25;
    detalle.costoAcabadoSoles = 15;
    detalle.muebles_lineas = [
      {
        id: "linea-1",
        inventario_producto_id: null,
        especie_label: "Madera",
        precioPorPt: 10,
        piezas: [
          { id: "pieza-1", cantidad: 2, espesor: 2, ancho: 6, largo: 5, descripcion: "Pieza 1" },
          { id: "pieza-2", cantidad: 1, espesor: 1, ancho: 12, largo: 8, descripcion: "Pieza 2" },
        ],
      },
    ];

    expect(computeTotalesDetalle(detalle).muebles).toBe(220);
  });
});

describe("margen de ganancia configurable", () => {
  test("aplica margen 30% sobre costo de produccion", () => {
    expect(calcularPrecioConMargen(100, 30)).toBe(130);
  });

  test("aplica margen personalizado 40%", () => {
    expect(calcularPrecioConMargen(100, 40)).toBe(140);
  });

  test("costo produccion 0 mantiene precio sugerido 0", () => {
    expect(calcularPrecioConMargen(0, 30)).toBe(0);
  });

  test("parsea decimales con coma", () => {
    expect(parseMargenGananciaInput("35,5")).toBe(35.5);
  });

  test("resumen de margen calcula ganancia y precio sugerido sin cambiar costo base", () => {
    const detalle = defaultCotizacionDetalleV1();
    detalle.rubros.muebles = true;
    detalle.muebles_lineas = [
      {
        id: "linea-1",
        inventario_producto_id: null,
        especie_label: "Madera",
        precioPorPt: 10,
        piezas: [{ id: "pieza-1", cantidad: 2, espesor: 2, ancho: 6, largo: 5, descripcion: "Pieza 1" }],
      },
    ];

    expect(computeResumenMargen(detalle, 30)).toEqual({
      costoProduccion: 100,
      margenPct: 30,
      ganancia: 30,
      precioSugerido: 130,
    });
  });

  test("lineas del comprobante no exponen margen ni costos internos", () => {
    const detalle = defaultCotizacionDetalleV1();
    detalle.rubros.muebles = true;
    detalle.costoManoObra = 20;
    detalle.muebles_lineas = [
      {
        id: "linea-1",
        inventario_producto_id: null,
        especie_label: "Madera",
        precioPorPt: 10,
        piezas: [{ id: "pieza-1", cantidad: 1, espesor: 2, ancho: 6, largo: 5, descripcion: "Pieza visible" }],
      },
    ];

    const textoComprobante = JSON.stringify(buildLineasResumen(detalle, 30)).toLowerCase();
    expect(textoComprobante).not.toContain("margen");
    expect(textoComprobante).not.toContain("ganancia");
    expect(textoComprobante).not.toContain("costo interno");
  });
});

describe("formatDate", () => {
  test("formatea fecha ISO a formato legible", () => {
    const result = formatDate("2026-05-15");
    // Debe contener día y año
    expect(result).toMatch(/\d/);
  });

  test("maneja strings de fecha con hora", () => {
    const result = formatDate("2026-05-15T10:30:00.000Z");
    expect(result).toMatch(/\d/);
  });
});

// Tests de cálculos críticos de negocio
describe("cálculos de utilidad", () => {
  test("utilidad = ingresos - egresos", () => {
    const ingresos = 5000;
    const egresos = 3200;
    const utilidad = ingresos - egresos;
    expect(utilidad).toBe(1800);
  });

  test("porcentaje de cambio entre periodos", () => {
    const actual = 1500;
    const anterior = 1200;
    const pct = ((actual - anterior) / anterior) * 100;
    expect(pct.toFixed(1)).toBe("25.0");
  });

  test("porcentaje sin división por cero", () => {
    const anterior = 0;
    const actual = 1500;
    const result = anterior === 0 ? (actual > 0 ? 100 : 0) : ((actual - anterior) / anterior) * 100;
    expect(result).toBe(100);
  });

  test("suma correcta de totales de caja", () => {
    const movimientos = [
      { tipo: "ingreso", monto: 1000 },
      { tipo: "ingreso", monto: 500 },
      { tipo: "egreso", monto: 200 },
      { tipo: "egreso", monto: 300 },
    ];
    const ingresos = movimientos.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
    const egresos = movimientos.filter((m) => m.tipo === "egreso").reduce((a, m) => a + m.monto, 0);
    expect(ingresos).toBe(1500);
    expect(egresos).toBe(500);
    expect(ingresos - egresos).toBe(1000);
  });
});

describe("cálculos de cubicaje madera aserrada", () => {
  test("PT real unitario se calcula correctamente por pieza individual", () => {
    // espesor: 2, ancho: 6, largo: 8.5
    // PT unitario real = (2 * 6 * 8.5) / 12 = 8.5
    const ptRealUnit = (2 * 6 * 8.5) / 12;
    expect(ptRealUnit).toBe(8.5);
  });

  test("PT total de venta usa PT real unitario por la cantidad de piezas", () => {
    const ptRealUnit = 8.5;
    const cantidad = 5;
    const ptTotalReal = ptRealUnit * cantidad;
    expect(ptTotalReal).toBe(42.5);
  });

  test("total de venta se calcula sobre el PT real total por el precio", () => {
    const totalPTReal = 42.5;
    const precioPorPT = 2.5;
    const totalVenta = totalPTReal * precioPorPT;
    expect(totalVenta).toBe(106.25);
  });

  test("caso 12 tablas de 1 x 8 x 10 mantiene 80 PT reales de referencia", () => {
    const cantidad = 12;
    const ptUnitarioReal = (1 * 8 * 10) / 12;
    const totalPTReal = ptUnitarioReal * cantidad;

    expect(ptUnitarioReal).toBeCloseTo(6.6666666667, 10);
    expect(totalPTReal).toBe(80);
  });

  test("caso comercial 12 tablas de 1 x 8 x 10 con P.UNIT S/23.30 da S/279.60", () => {
    const cantidad = 12;
    const precioUnitarioComercial = 23.3;
    const totalVenta = cantidad * precioUnitarioComercial;

    expect(totalVenta).toBe(279.6);
  });
});
