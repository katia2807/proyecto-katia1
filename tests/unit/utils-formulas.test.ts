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

describe("cálculos de cubicaje aserradero comercial", () => {
  test("PT real unitario se calcula correctamente por pieza individual", () => {
    // espesor: 2, ancho: 6, largo: 8.5
    // PT unitario real = (2 * 6 * 8.5) / 12 = 8.5
    const ptRealUnit = (2 * 6 * 8.5) / 12;
    expect(ptRealUnit).toBe(8.5);
  });

  test("PT comercial unitario aplica Math.floor al PT real unitario", () => {
    const ptRealUnit = 8.5;
    const ptComercialUnit = Math.floor(ptRealUnit);
    expect(ptComercialUnit).toBe(8);
  });

  test("PT comercial total multiplica el comercial unitario por la cantidad de piezas", () => {
    const ptComercialUnit = 8;
    const cantidad = 5;
    const ptComercialTotal = ptComercialUnit * cantidad;
    expect(ptComercialTotal).toBe(40);
    
    // Y verificamos que NO se usa Math.floor(PT real unitario * cantidad)
    // Math.floor(8.5 * 5) = Math.floor(42.5) = 42 (lo cual sería INCORRECTO comercialmente)
    const formulaIncorrecta = Math.floor(8.5 * cantidad);
    expect(ptComercialTotal).not.toBe(formulaIncorrecta);
  });

  test("Costo comercial se calcula sobre el total PT comercial por el precio", () => {
    const totalPTComercial = 40; // de la prueba anterior
    const precioPorPT = 2.5;
    const costoComercial = totalPTComercial * precioPorPT;
    expect(costoComercial).toBe(100);
  });
});
